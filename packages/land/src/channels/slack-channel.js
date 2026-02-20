import { z } from "zod";

const OptionalTokenSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  });

const SlackChannelConfigSchema = z.looseObject({
  channel: z.literal("slack"),
  enabled: z.boolean().default(true),
  mode: z.literal("socket").default("socket"),
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
  #isRunning = false;

  /**
   * @param {string} channelPath
   * @param {Record<string, unknown>} rawConfig
   */
  constructor(channelPath, rawConfig) {
    this.#path = channelPath;
    this.#config = parseChannelConfig(rawConfig);
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

    const { App, LogLevel } = await import("@slack/bolt");
    const app = new App({
      token: botUserOAuthToken,
      appToken: appLevelToken,
      socketMode: true,
      logLevel: LogLevel.INFO,
    });

    app.message(async ({ message, say }) => {
      if (isBotMessage(message)) {
        return;
      }

      const text = getMessageText(message);
      if (!text) {
        return;
      }

      await say(text);
    });

    await app.start();
    this.#app = app;
    this.#isRunning = true;
    console.log(`Slack channel connected at: ${this.#path}`);
  }

  async stop() {
    if (!this.#app) {
      return;
    }

    await this.#app.stop();
    this.#app = null;
    this.#isRunning = false;
    console.log(`Slack channel stopped at: ${this.#path}`);
  }

  async sendMessage(channel, text) {
    if (!this.#app) {
      throw new Error(`Slack channel is not connected: ${this.#path}`);
    }

    await this.#app.client.chat.postMessage({
      channel,
      text,
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

function isBotMessage(message) {
  return Boolean(message.bot_id || message.subtype === "bot_message");
}

function getMessageText(message) {
  if (typeof message.text !== "string") {
    return "";
  }
  return message.text.trim();
}
