import { z } from "zod";
import { InProcessChatAgentRuntime } from "../agent-runtime/chat-agent-runtime.js";
import { OptionalTokenSchema } from "./channel-utils.js";
import { createChannelAgentRuntime } from "./channel-agent-runtime.js";
import { createProgressReply } from "./progress-reply.js";
import { storeSlackFile } from "./slack/slack-file-store.js";
import { buildSlackInboundContent } from "./slack/slack-inbound-content.js";
import {
  getMessageDate,
  getMessageText,
  getThreadContext,
  hasSlackFiles,
  isSlackUserMessage,
  normalizeIncomingText,
} from "./slack/slack-input-parser.js";
import { SlackTransport } from "./slack/slack-transport.js";
import { ThreadedChannelRuntime } from "./threaded-channel-runtime.js";

const SlackChannelConfigSchema = z.looseObject({
  channel: z.literal("slack"),
  enabled: z.boolean().default(true),
  botUserOAuthToken: OptionalTokenSchema,
  appLevelToken: OptionalTokenSchema,
});
export class SlackChannel {
  /** @type {string} */
  #path;
  /** @type {import("zod").infer<typeof SlackChannelConfigSchema>} */
  #config;
  /** @type {null | import("@slack/bolt").App} */
  #app = null;
  /** @type {null | SlackTransport} */
  #transport = null;
  /** @type {string | null} */
  #botUserId = null;
  /** @type {null | import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime} */
  #agentRuntime = null;
  /** @type {ThreadedChannelRuntime} */
  #threadRuntime;
  /** @type {{
   *  createSlackApp: (input: { botUserOAuthToken: string; appLevelToken: string }) => Promise<any>;
   *  storeSlackFile: typeof storeSlackFile;
   *  createAgentRuntime: (options: {
   *    lang: import("aiwrapper").LanguageProvider;
   *    instructions: string;
   *    loadInstructions?: (input: { threadId: string; threadDir: string }) => Promise<string>;
   *    loadTools?: (input: { threadId: string; threadDir: string }) => Promise<Array<any>>;
   *    defaultCwd: string;
   *  }) => import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime;
   * }} */
  #dependencies;
  #isRunning = false;

  /**
   * @param {string} channelPath
   * @param {Record<string, unknown>} rawConfig
   * @param {Partial<{
   *  createSlackApp: (input: { botUserOAuthToken: string; appLevelToken: string }) => Promise<any>;
   *  storeSlackFile: typeof storeSlackFile;
   *  createAgentRuntime: (options: {
   *    lang: import("aiwrapper").LanguageProvider;
   *    instructions: string;
   *    loadInstructions?: (input: { threadId: string; threadDir: string }) => Promise<string>;
   *    loadTools?: (input: { threadId: string; threadDir: string }) => Promise<Array<any>>;
   *    defaultCwd: string;
   *  }) => import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime;
   * }>} [dependencies]
   */
  constructor(channelPath, rawConfig, dependencies = {}) {
    this.#path = channelPath;
    this.#config = parseChannelConfig(rawConfig);
    this.#threadRuntime = new ThreadedChannelRuntime({ channelPath, channelName: "slack" });
    this.#dependencies = {
      ...createDefaultDependencies(),
      ...dependencies,
    };
  }

  async run() {
    if (this.#isRunning) {
      return;
    }

    console.log(`Starting Slack channel at: ${this.#path}`);
    if (!this.#config.enabled) {
      console.log(`Slack channel disabled at: ${this.#path}`);
      return;
    }

    const { botUserOAuthToken, appLevelToken } = this.#config;

    if (!botUserOAuthToken || !appLevelToken) {
      console.log(
        `Slack channel missing tokens at ${this.#path}. Set botUserOAuthToken/appLevelToken in channel config.`,
      );
      return;
    }

    try {
      this.#agentRuntime = await createChannelAgentRuntime({
        channelPath: this.#path,
        channelName: "slack",
        createAgentRuntime: this.#dependencies.createAgentRuntime,
      });
    } catch (error) {
      console.log(`Slack channel ${error.message}`);
      return;
    }
    this.#threadRuntime.setAgentRuntime(this.#agentRuntime);

    const app = await this.#dependencies.createSlackApp({
      botUserOAuthToken,
      appLevelToken,
    });
    this.#app = app;
    this.#transport = new SlackTransport(app);

    app.message(async ({ message }) => {
      await this.#handleIncomingMessage(message);
    });

    const auth = await app.client.auth.test();
    this.#botUserId = auth.user_id || null;

    await app.start();
    this.#isRunning = true;
    console.log(`Slack channel connected at: ${this.#path}`);
  }

  async stop() {
    if (!this.#app && !this.#agentRuntime) {
      return;
    }

    const failures = [];
    try {
      await this.#app?.stop();
    } catch (error) {
      failures.push(error);
    }
    await this.#threadRuntime.drain();
    try {
      await this.#agentRuntime?.stop();
    } catch (error) {
      failures.push(error);
    }
    this.#app = null;
    this.#transport = null;
    this.#agentRuntime = null;
    this.#threadRuntime.clear();
    this.#botUserId = null;
    this.#isRunning = false;
    console.log(`Slack channel stopped at: ${this.#path}`);
    if (failures.length) {
      throw new AggregateError(failures, "Failed to stop the Slack channel cleanly.");
    }
  }

  /**
   * @param {any} message
   */
  async #handleIncomingMessage(message) {
    try {
      if (!this.#app || !this.#transport || !isSlackUserMessage(message)) {
        return;
      }

      if (this.#botUserId && message.user === this.#botUserId) {
        return;
      }

      const text = normalizeIncomingText(getMessageText(message), this.#botUserId);
      const hasFiles = hasSlackFiles(message);
      if (!text && !hasFiles) {
        return;
      }

      const thread = getThreadContext(message);
      await this.#threadRuntime.enqueue(thread.threadId, async () => {
        const inboundText = await buildSlackInboundContent({
          channelPath: this.#path,
          threadId: thread.threadId,
          normalizedText: text,
          files: await this.#transport.resolveInboundFiles(message),
          createdAt: getMessageDate(message),
          botUserOAuthToken: this.#config.botUserOAuthToken ?? "",
          storeFile: this.#dependencies.storeSlackFile,
        });
        if (!inboundText) {
          return;
        }
        await this.#processThreadMessage(thread, message.user, inboundText);
      });
    } catch (error) {
      console.error("Failed to process Slack inbound message:", error);
    }
  }

  /**
   * @param {{ threadId: string; channelId: string; threadTs: string | null }} thread
   * @param {string} userId
   * @param {string} text
   */
  async #processThreadMessage(thread, userId, text) {
    if (!this.#transport) {
      return;
    }

    const transport = this.#transport;
    const reply = createProgressReply({
      async send(message) {
        const posted = await transport.sendMessage(
          thread.channelId,
          message,
          thread.threadTs ?? undefined,
        );
        return posted?.ts || null;
      },
      update: (messageId, message) =>
        transport.updateMessage(thread.channelId, String(messageId), message),
    });

    await this.#threadRuntime.handleThreadMessage({
      thread,
      userId,
      text,
      agentInput: {
        sendSlackFile: async (payload) => transport.sendFile(thread, payload),
      },
      state: (input) => ({
        channelId: thread.channelId,
        threadTs: thread.threadTs,
        updatedAt: new Date().toISOString(),
        lastUserId: userId,
        responded: input.result.responded,
      }),
      onRespondStart: reply.start,
      sendIntermediateReply: reply.sendWorking,
      sendReply: reply.sendFinal,
    });
  }

}

function parseChannelConfig(rawConfig) {
  const result = SlackChannelConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid Slack channel config: ${details}`);
  }
  return result.data;
}

function createDefaultDependencies() {
  return {
    async createSlackApp({ botUserOAuthToken, appLevelToken }) {
      const { App, LogLevel } = await import("@slack/bolt");
      return new App({
        token: botUserOAuthToken,
        appToken: appLevelToken,
        socketMode: true,
        logLevel: LogLevel.INFO,
      });
    },
    storeSlackFile,
    createAgentRuntime(options) {
      return new InProcessChatAgentRuntime(options);
    },
  };
}
