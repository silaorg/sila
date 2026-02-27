import fs from "node:fs/promises";
import path from "node:path";
import { Lang } from "aiwrapper";
import { z } from "zod";
import { InProcessChatAgentRuntime } from "@sila/agents";
import {
  OptionalTokenSchema,
  enqueueSerialTask,
  loadChannelInstructions,
  readOpenAiApiKey,
  sanitizeThreadId,
  saveThreadState,
} from "./channel-utils.js";

const SlackChannelConfigSchema = z.looseObject({
  channel: z.literal("slack"),
  enabled: z.boolean().default(true),
  mode: z.literal("socket").default("socket"),
  botUserOAuthToken: OptionalTokenSchema,
  appLevelToken: OptionalTokenSchema,
});
const OPENAI_MODEL = "gpt-5.2";

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
  /** @type {null | import("@sila/agents").InProcessChatAgentRuntime} */
  #agentRuntime = null;
  /** @type {{
   *  createSlackApp: (input: { botUserOAuthToken: string; appLevelToken: string }) => Promise<any>;
   *  createAgentRuntime: (options: {
   *    lang: import("aiwrapper").LanguageProvider;
   *    instructions: string;
   *    loadInstructions?: (input: { threadId: string; threadDir: string }) => Promise<string>;
   *    defaultCwd: string;
   *  }) => import("@sila/agents").InProcessChatAgentRuntime;
   * }} */
  #dependencies;
  #isRunning = false;

  /**
   * @param {string} channelPath
   * @param {Record<string, unknown>} rawConfig
   * @param {Partial<{
   *  createSlackApp: (input: { botUserOAuthToken: string; appLevelToken: string }) => Promise<any>;
   *  createAgentRuntime: (options: {
   *    lang: import("aiwrapper").LanguageProvider;
   *    instructions: string;
   *    loadInstructions?: (input: { threadId: string; threadDir: string }) => Promise<string>;
   *    defaultCwd: string;
   *  }) => import("@sila/agents").InProcessChatAgentRuntime;
   * }>} [dependencies]
   */
  constructor(channelPath, rawConfig, dependencies = {}) {
    this.#path = channelPath;
    this.#config = parseChannelConfig(rawConfig);
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

    const openAiApiKey = await readOpenAiApiKey(this.#path);
    if (!openAiApiKey) {
      console.log(
        `Slack channel missing OpenAI API key for ${this.#path}. Set OPENAI_API_KEY in land .env or process env.`,
      );
      return;
    }

    this.#lang = Lang.openai({ apiKey: openAiApiKey, model: OPENAI_MODEL });
    const landPath = path.resolve(this.#path, "..", "..");
    const instructions = await loadChannelInstructions(landPath, "slack");
    this.#agentRuntime = this.#dependencies.createAgentRuntime({
      lang: this.#lang,
      defaultCwd: landPath,
      instructions,
      loadInstructions: (input = {}) => loadChannelInstructions(landPath, "slack", input.threadDir),
    });

    const app = await this.#dependencies.createSlackApp({
      botUserOAuthToken,
      appLevelToken,
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
    if (!this.#app && !this.#agentRuntime) {
      return;
    }

    await this.#agentRuntime?.stop();
    if (this.#app) {
      await this.#app.stop();
    }
    this.#app = null;
    this.#lang = null;
    this.#agentRuntime = null;
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
      mrkdwn: true,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    });
  }

  /**
   * @param {{ threadId: string; channelId: string; threadTs: string | null }} thread
   * @param {{ path?: string; files?: Array<{ path: string; filename?: string; title?: string }>; title?: string; comment?: string }} payload
   */
  async #sendSlackFile(thread, payload) {
    if (!this.#app) {
      throw new Error(`Slack channel is not connected: ${this.#path}`);
    }

    const { path: filePath, files, title, comment } = payload;
    const hasManyFiles = Array.isArray(files) && files.length > 0;
    let upload;

    if (hasManyFiles) {
      upload = await this.#app.client.files.uploadV2({
        channel_id: thread.channelId,
        file_uploads: files.map((fileEntry) => ({
          file: fileEntry.path,
          filename: fileEntry.filename || path.basename(fileEntry.path),
          ...(fileEntry.title ? { title: fileEntry.title } : {}),
        })),
        ...(thread.threadTs ? { thread_ts: thread.threadTs } : {}),
        ...(comment ? { initial_comment: comment } : {}),
      });
    } else {
      if (!filePath) {
        throw new Error("Missing file path for Slack upload.");
      }
      upload = await this.#app.client.files.uploadV2({
        channel_id: thread.channelId,
        file: filePath,
        filename: path.basename(filePath),
        ...(thread.threadTs ? { thread_ts: thread.threadTs } : {}),
        ...(title ? { title } : {}),
        ...(comment ? { initial_comment: comment } : {}),
      });
    }

    const uploadedFiles = collectUploadedFiles(upload);
    const firstFile = uploadedFiles[0] ?? null;
    return {
      fileId: firstFile?.id ?? null,
      permalink: getFileLink(firstFile),
      fileIds: uploadedFiles.map((file) => file?.id).filter(Boolean),
      permalinks: uploadedFiles.map((file) => getFileLink(file)).filter(Boolean),
    };
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
    await enqueueSerialTask(this.#processingThreads, threadId, task);
  }

  /**
   * @param {{ threadId: string; channelId: string; threadTs: string | null }} thread
   * @param {string} userId
   * @param {string} text
   */
  async #processThreadMessage(thread, userId, text) {
    if (!this.#lang || !this.#agentRuntime) {
      return;
    }

    const threadDir = path.join(this.#path, thread.threadId);
    await fs.mkdir(threadDir, { recursive: true });

    const result = await this.#agentRuntime.handleThreadMessage({
      threadId: thread.threadId,
      threadDir,
      userId,
      text,
      sendSlackFile: async (payload) => this.#sendSlackFile(thread, payload),
    });

    await saveThreadState(threadDir, {
      channelId: thread.channelId,
      threadTs: thread.threadTs,
      updatedAt: new Date().toISOString(),
      lastUserId: userId,
      responded: result.responded,
    });

    if (!result.responded || !result.answer) {
      return;
    }

    await this.sendMessage(thread.channelId, result.answer, thread.threadTs ?? undefined);
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

function collectUploadedFiles(uploadResponse) {
  const outerFiles = Array.isArray(uploadResponse?.files) ? uploadResponse.files : [];

  // Some clients expose files directly as [{ id, permalink, ... }].
  const directFiles = outerFiles.filter((entry) => isSlackUploadedFile(entry));
  if (directFiles.length > 0) {
    return directFiles;
  }

  // Slack WebClient filesUploadV2 often returns { files: [{ ok, files: [...] }] }.
  const nestedFiles = [];
  for (const entry of outerFiles) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    if (!Array.isArray(entry.files)) {
      continue;
    }
    for (const nestedEntry of entry.files) {
      if (isSlackUploadedFile(nestedEntry)) {
        nestedFiles.push(nestedEntry);
      }
    }
  }

  return nestedFiles;
}

function isSlackUploadedFile(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  return typeof entry.id === "string"
    || typeof entry.permalink === "string"
    || typeof entry.url_private === "string"
    || typeof entry.url_private_download === "string";
}

function getFileLink(file) {
  if (!file || typeof file !== "object") {
    return null;
  }
  return file.permalink ?? file.url_private_download ?? file.url_private ?? null;
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
    createAgentRuntime(options) {
      return new InProcessChatAgentRuntime(options);
    },
  };
}
