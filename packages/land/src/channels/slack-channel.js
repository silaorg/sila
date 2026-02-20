import fs from "node:fs/promises";
import path from "node:path";
import { ChatAgent, Lang, LangMessage, z as aiZ } from "aiwrapper";
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
  aiModel: z.string().min(1).default("gpt-5-nano"),
});

const THREAD_MESSAGES_FILE_NAME = "messages.json";
const THREAD_STATE_FILE_NAME = "state.json";

export class SlackChannel {
  /** @type {string} */
  #path;
  /** @type {import("zod").infer<typeof SlackChannelConfigSchema>} */
  #config;
  /** @type {null | import("@slack/bolt").App} */
  #app = null;
  /** @type {null | import("aiwrapper").LanguageProvider} */
  #lang = null;
  /** @type {string | null} */
  #botUserId = null;
  /** @type {Map<string, Promise<void>>} */
  #processingThreads = new Map();
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

    const openAiApiKey = await readOpenAiApiKey(this.#path);
    if (!openAiApiKey) {
      console.log(
        `Slack channel missing OpenAI API key for ${this.#path}. Set providers/openai.json apiKey or OPENAI_API_KEY env.`,
      );
      return;
    }

    this.#lang = Lang.openai({ apiKey: openAiApiKey, model: this.#config.aiModel });

    const { App, LogLevel } = await import("@slack/bolt");
    const app = new App({
      token: botUserOAuthToken,
      appToken: appLevelToken,
      socketMode: true,
      logLevel: LogLevel.INFO,
    });

    app.message(async ({ message }) => {
      await this.#handleIncomingMessage(message);
    });

    const auth = await app.client.auth.test();
    this.#botUserId = auth.user_id || null;

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
    this.#lang = null;
    this.#botUserId = null;
    this.#processingThreads.clear();
    this.#isRunning = false;
    console.log(`Slack channel stopped at: ${this.#path}`);
  }

  async sendMessage(channel, text, threadTs) {
    if (!this.#app) {
      throw new Error(`Slack channel is not connected: ${this.#path}`);
    }

    await this.#app.client.chat.postMessage({
      channel,
      text,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    });
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

      const text = getMessageText(message);
      if (!text) {
        return;
      }

      const thread = getThreadContext(message);
      const normalizedText = normalizeIncomingText(text, this.#botUserId);
      if (!normalizedText) {
        return;
      }

      await this.#enqueueThread(thread.threadId, async () => {
        await this.#processThreadMessage(thread, message.user, normalizedText);
      });
    } catch (error) {
      console.error("Failed to process Slack inbound message:", error);
    }
  }

  /**
   * @param {string} threadId
   * @param {() => Promise<void>} task
   */
  async #enqueueThread(threadId, task) {
    const previous = this.#processingThreads.get(threadId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    this.#processingThreads.set(threadId, current);
    try {
      await current;
    } finally {
      if (this.#processingThreads.get(threadId) === current) {
        this.#processingThreads.delete(threadId);
      }
    }
  }

  /**
   * @param {{ threadId: string; channelId: string; threadTs: string | null }} thread
   * @param {string} userId
   * @param {string} text
   */
  async #processThreadMessage(thread, userId, text) {
    if (!this.#lang) {
      return;
    }

    const threadDir = path.join(this.#path, thread.threadId);
    await fs.mkdir(threadDir, { recursive: true });

    const agent = await loadThreadAgent(threadDir, this.#lang);
    agent.messages.instructions = defaultSlackInstructions();
    agent.messages.addUserMessage(`<@${userId}>: ${text}`);
    await saveThreadMessages(threadDir, agent.messages);

    const shouldRespond = await this.#shouldRespond(agent);
    if (!shouldRespond) {
      await saveThreadState(threadDir, {
        channelId: thread.channelId,
        threadTs: thread.threadTs,
        updatedAt: new Date().toISOString(),
        lastUserId: userId,
        responded: false,
      });
      return;
    }

    const result = await agent.run([]);
    await saveThreadMessages(threadDir, agent.messages);
    await saveThreadState(threadDir, {
      channelId: thread.channelId,
      threadTs: thread.threadTs,
      updatedAt: new Date().toISOString(),
      lastUserId: userId,
      responded: true,
    });

    const answer = typeof result?.answer === "string" ? result.answer.trim() : "";
    if (!answer) {
      return;
    }

    await this.sendMessage(thread.channelId, answer, thread.threadTs ?? undefined);
  }

  /**
   * Decide if the assistant should respond to the latest user message.
   * Mirrors the lightweight "context decision" pattern from telegram-bot.
   * @param {import("aiwrapper").ChatAgent} agent
   * @returns {Promise<boolean>}
   */
  async #shouldRespond(agent) {
    if (!this.#lang || agent.messages.length === 0) {
      return true;
    }

    const history = agent.messages.slice(-6);
    const historyText = history.map((message) => `${message.role}: ${message.text}`).join("\n\n");

    const decisionSchema = aiZ.object({
      respond: aiZ
        .boolean()
        .describe("Whether the assistant should respond to the last user message."),
    });

    const decisionPrompt = `
You are deciding whether an assistant should respond to the latest user message in a chat.

Rules:
- Return false for short acknowledgements like "ok", "thanks", "got it", unless user asks a follow-up.
- Return true when user asks a question, requests work, or starts a new topic.
- When unsure, return true.

Conversation history:
${historyText}
`;

    try {
      const decision = await this.#lang.askForObject(decisionPrompt, decisionSchema);
      return Boolean(decision?.object?.respond);
    } catch (error) {
      console.error("Failed to run respond/no-respond decision; defaulting to respond:", error);
      return true;
    }
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

function isSlackUserMessage(message) {
  if (!message || typeof message !== "object") {
    return false;
  }
  if (message.subtype || message.bot_id) {
    return false;
  }
  if (typeof message.user !== "string" || !message.user.length) {
    return false;
  }
  return true;
}

function getMessageText(message) {
  if (typeof message.text !== "string") {
    return "";
  }
  return message.text.trim();
}

function normalizeIncomingText(text, botUserId) {
  let normalized = text;
  if (botUserId) {
    const mention = `<@${botUserId}>`;
    normalized = normalized.split(mention).join(" ");
  }
  return normalized.trim();
}

function getThreadContext(message) {
  const channelId = String(message.channel);
  if (message.channel_type === "im") {
    return {
      threadId: sanitizeThreadId(channelId),
      channelId,
      threadTs: null,
    };
  }

  if (!message.thread_ts) {
    return {
      threadId: sanitizeThreadId(`${channelId}_main`),
      channelId,
      threadTs: null,
    };
  }

  const rootTs = String(message.thread_ts);
  return {
    threadId: sanitizeThreadId(`${channelId}_${rootTs}`),
    channelId,
    threadTs: rootTs,
  };
}

function sanitizeThreadId(input) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function loadThreadAgent(threadDir, lang) {
  const agent = new ChatAgent(lang);
  const messages = await loadThreadMessages(threadDir);
  if (messages.length > 0) {
    agent.messages.push(...messages);
  }
  return agent;
}

async function loadThreadMessages(threadDir) {
  const filePath = path.join(threadDir, THREAD_MESSAGES_FILE_NAME);
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`Invalid ${THREAD_MESSAGES_FILE_NAME} at ${filePath}, starting with empty history.`);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error(`Invalid ${THREAD_MESSAGES_FILE_NAME} format at ${filePath}, expected array.`);
    return [];
  }

  return parsed.map((item) => new LangMessage(item.role, item.items, item.meta));
}

async function saveThreadMessages(threadDir, messages) {
  const filePath = path.join(threadDir, THREAD_MESSAGES_FILE_NAME);
  const serializable = Array.from(messages).map((message) => ({
    role: message.role,
    items: message.items,
    meta: message.meta,
  }));
  await fs.writeFile(filePath, `${JSON.stringify(serializable, null, 2)}\n`, "utf8");
}

async function saveThreadState(threadDir, state) {
  const filePath = path.join(threadDir, THREAD_STATE_FILE_NAME);
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function readOpenAiApiKey(channelPath) {
  const providerPath = path.resolve(channelPath, "..", "..", "providers", "openai.json");
  const fromConfig = await readProviderApiKey(providerPath);
  if (fromConfig) {
    return fromConfig;
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }
  return null;
}

async function readProviderApiKey(providerPath) {
  let raw;
  try {
    raw = await fs.readFile(providerPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.apiKey === "string" && parsed.apiKey.trim()) {
      return parsed.apiKey.trim();
    }
  } catch {
    console.error(`Invalid JSON in provider config: ${providerPath}`);
  }

  return null;
}

function defaultSlackInstructions() {
  return [
    "You are a concise assistant in Slack.",
    "Use short, direct answers.",
    "If context is missing, ask one clear follow-up question.",
  ].join("\n");
}
