import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { InProcessChatAgentRuntime } from "../agent-runtime/chat-agent-runtime.js";
import {
  OptionalTokenSchema,
  formatWorkingMessage,
  loadChannelLanguageProvider,
  loadChannelInstructions,
  loadChannelTools,
  toAgentRelativePath,
} from "./channel-utils.js";
import { storeSlackFile } from "./slack/slack-file-store.js";
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
  /** @type {null | import("aiwrapper").LanguageProvider} */
  #lang = null;
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

    const workspacePath = path.resolve(this.#path, "..", "..");
    let languageProvider;
    try {
      languageProvider = await loadChannelLanguageProvider(this.#path);
    } catch (error) {
      console.log(`Slack channel ${error.message}`);
      return;
    }

    this.#lang = languageProvider.lang;
    const instructions = await loadChannelInstructions(workspacePath, "slack");
    this.#agentRuntime = this.#dependencies.createAgentRuntime({
      lang: this.#lang,
      defaultCwd: workspacePath,
      instructions,
      loadInstructions: (input = {}) => loadChannelInstructions(workspacePath, "slack", input.threadDir),
      loadTools: (input = {}) => loadChannelTools(workspacePath, "slack", input),
    });
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

    await this.#agentRuntime?.stop();
    if (this.#app) {
      await this.#app.stop();
    }
    this.#app = null;
    this.#transport = null;
    this.#lang = null;
    this.#agentRuntime = null;
    this.#threadRuntime.clear();
    this.#botUserId = null;
    this.#isRunning = false;
    console.log(`Slack channel stopped at: ${this.#path}`);
  }

  /**
   * @param {any} message
   */
  async #handleIncomingMessage(message) {
    try {
      if (!this.#app || !this.#lang || !isSlackUserMessage(message)) {
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
        const inboundText = await this.#buildInboundMessageText(thread, message, text);
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
   * @param {any} message
   * @param {string} normalizedText
   */
  async #buildInboundMessageText(thread, message, normalizedText) {
    const inboundFiles = await this.#resolveInboundFiles(message);
    if (!inboundFiles.length) {
      return normalizedText;
    }

    const threadDir = path.join(this.#path, thread.threadId);
    await fs.mkdir(threadDir, { recursive: true });

    const createdAt = getMessageDate(message);
    const uploadedLines = [];

    for (const file of inboundFiles) {
      try {
        const localPath = await this.#dependencies.storeSlackFile({
          threadDir,
          fileUrl: file.fileUrl,
          originalName: file.fileName,
          createdAt,
          botUserOAuthToken: this.#config.botUserOAuthToken ?? "",
        });
        const relativePath = toAgentRelativePath(localPath, threadDir);
        uploadedLines.push(`[Uploaded a ${file.label}: ${relativePath}]`);
      } catch (error) {
        console.error(`Failed to store Slack file ${file.fileName}:`, error);
      }
    }

    const uploadsText = uploadedLines.join("\n");
    if (uploadsText && normalizedText) {
      return `${uploadsText}\n\n${normalizedText}`;
    }
    return uploadsText || normalizedText;
  }

  /**
   * @param {any} message
   */
  async #resolveInboundFiles(message) {
    if (!this.#transport) {
      return [];
    }
    return this.#transport.resolveInboundFiles(message);
  }

  /**
   * @param {{ threadId: string; channelId: string; threadTs: string | null }} thread
   * @param {string} userId
   * @param {string} text
   */
  async #processThreadMessage(thread, userId, text) {
    if (!this.#lang || !this.#transport) {
      return;
    }

    const transport = this.#transport;
    let progressMessageTs = null;
    const ensureProgressMessage = async () => {
      if (progressMessageTs) {
        return progressMessageTs;
      }

      const posted = await transport.sendMessage(
        thread.channelId,
        "🤔 Thinking...",
        thread.threadTs ?? undefined,
      );
      progressMessageTs = posted?.ts || null;
      return progressMessageTs;
    };

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
      onRespondStart: ensureProgressMessage,
      sendIntermediateReply: async (payload) => {
        const workingText = formatWorkingMessage(payload.text);
        const messageTs = await ensureProgressMessage();
        if (messageTs) {
          await transport.updateMessage(thread.channelId, messageTs, workingText);
          return;
        }
        await transport.sendMessage(thread.channelId, workingText, thread.threadTs ?? undefined);
      },
      sendReply: async (answer) => {
        if (progressMessageTs) {
          await transport.updateMessage(thread.channelId, progressMessageTs, answer);
          return;
        }
        await transport.sendMessage(thread.channelId, answer, thread.threadTs ?? undefined);
      },
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
