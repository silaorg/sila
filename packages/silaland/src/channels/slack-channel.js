import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { InProcessChatAgentRuntime } from "../agent-runtime/chat-agent-runtime.js";
import {
  OptionalTokenSchema,
  loadChannelLanguageProvider,
  loadChannelInstructions,
  loadChannelTools,
  sanitizeThreadId,
} from "./channel-utils.js";
import { storeSlackFile } from "./slack/slack-file-store.js";
import { ThreadedChannelRuntime } from "./threaded-channel-runtime.js";

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
    this.#threadRuntime = new ThreadedChannelRuntime({ channelPath });
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

    const landPath = path.resolve(this.#path, "..", "..");
    let languageProvider;
    try {
      languageProvider = await loadChannelLanguageProvider(this.#path);
    } catch (error) {
      console.log(`Slack channel ${error.message}`);
      return;
    }

    this.#lang = languageProvider.lang;
    const instructions = await loadChannelInstructions(landPath, "slack");
    this.#agentRuntime = this.#dependencies.createAgentRuntime({
      lang: this.#lang,
      defaultCwd: landPath,
      instructions,
      loadInstructions: (input = {}) => loadChannelInstructions(landPath, "slack", input.threadDir),
      loadTools: (input = {}) => loadChannelTools(landPath, "slack", input),
    });
    this.#threadRuntime.setAgentRuntime(this.#agentRuntime);

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
    this.#threadRuntime.clear();
    this.#botUserId = null;
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
        const relativePath = this.#toAgentRelativePath(localPath, threadDir);
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
    if (!this.#app) {
      return [];
    }

    const messageFiles = getMessageFiles(message);
    if (!messageFiles.length) {
      return [];
    }

    const resolvedFiles = [];
    for (const file of messageFiles) {
      const direct = normalizeInboundFile(file);
      if (direct) {
        resolvedFiles.push(direct);
        continue;
      }

      const fileId = getSlackFileId(file);
      if (!fileId || !this.#app.client?.files?.info) {
        continue;
      }

      try {
        const info = await this.#app.client.files.info({ file: fileId });
        const enriched = normalizeInboundFile(info?.file);
        if (enriched) {
          resolvedFiles.push(enriched);
        }
      } catch (error) {
        console.error(`Failed to resolve Slack file info for ${fileId}:`, error);
      }
    }

    return resolvedFiles;
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

    await this.#threadRuntime.handleThreadMessage({
      thread,
      userId,
      text,
      agentInput: {
        sendSlackFile: async (payload) => this.#sendSlackFile(thread, payload),
      },
      state: (input) => ({
        channelId: thread.channelId,
        threadTs: thread.threadTs,
        updatedAt: new Date().toISOString(),
        lastUserId: userId,
        responded: input.result.responded,
      }),
      sendReply: async (answer) => this.sendMessage(thread.channelId, answer, thread.threadTs ?? undefined),
    });
  }

  /**
   * @param {string} absolutePath
   * @param {string} baseDir
   */
  #toAgentRelativePath(absolutePath, baseDir) {
    const relative = path.relative(baseDir, absolutePath);
    return relative.split(path.sep).join("/");
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
  if (message.bot_id) {
    return false;
  }
  if (typeof message.subtype === "string" && message.subtype !== "file_share") {
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

function getMessageDate(message) {
  const timestamp = String(message?.ts ?? "").trim();
  if (!timestamp.length) {
    return new Date();
  }

  const unixSeconds = Number(timestamp.split(".")[0]);
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) {
    return new Date();
  }
  return new Date(unixSeconds * 1000);
}

function getThreadContext(message) {
  const channelId = String(message.channel);
  const rootTs = message.thread_ts === undefined || message.thread_ts === null || message.thread_ts === ""
    ? null
    : String(message.thread_ts);
  if (rootTs) {
    return {
      threadId: sanitizeThreadId(`${channelId}_${rootTs}`),
      channelId,
      threadTs: rootTs,
    };
  }

  if (message.channel_type === "im") {
    return {
      threadId: sanitizeThreadId(channelId),
      channelId,
      threadTs: null,
    };
  }

  return {
    threadId: sanitizeThreadId(`${channelId}_main`),
    channelId,
    threadTs: null,
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

function hasSlackFiles(message) {
  return getMessageFiles(message).length > 0;
}

function getMessageFiles(message) {
  if (!Array.isArray(message?.files)) {
    return [];
  }
  return message.files.filter((file) => file && typeof file === "object");
}

function normalizeInboundFile(file) {
  if (!file || typeof file !== "object") {
    return null;
  }

  const fileUrl = getSlackFileUrl(file);
  if (!fileUrl) {
    return null;
  }

  return {
    fileName: getSlackFileName(file),
    fileUrl,
    label: getSlackFileLabel(file),
  };
}

function getSlackFileUrl(file) {
  const downloadUrl = String(file.url_private_download || "").trim();
  if (downloadUrl) {
    return downloadUrl;
  }

  const privateUrl = String(file.url_private || "").trim();
  if (privateUrl) {
    return privateUrl;
  }

  return "";
}

function getSlackFileName(file) {
  const name = String(file.name || "").trim();
  if (name) {
    return name;
  }
  const title = String(file.title || "").trim();
  if (title) {
    return title;
  }
  const fileId = getSlackFileId(file);
  if (fileId) {
    return `${fileId}.bin`;
  }
  return `file_${Date.now()}`;
}

function getSlackFileId(file) {
  const fileId = String(file?.id || "").trim();
  return fileId || "";
}

function getSlackFileLabel(file) {
  const mimeType = String(file.mimetype || "").toLowerCase();
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  return "file";
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
    storeSlackFile,
    createAgentRuntime(options) {
      return new InProcessChatAgentRuntime(options);
    },
  };
}
