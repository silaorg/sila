import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Lang } from "aiwrapper";
import OpenAI from "openai";
import { z } from "zod";
import { InProcessChatAgentRuntime, defaultTelegramInstructions } from "@sila/agents";
import { appendSkillCatalogInstructions, loadSkillIndex } from "../skills.js";

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

const TelegramChannelConfigSchema = z.looseObject({
  channel: z.literal("telegram"),
  enabled: z.boolean().default(true),
  botToken: OptionalTokenSchema,
  aiModel: z.string().min(1).default("gpt-5.2"),
});

const THREAD_STATE_FILE_NAME = "state.json";

export class TelegramChannel {
  /** @type {string} */
  #path;
  /** @type {import("zod").infer<typeof TelegramChannelConfigSchema>} */
  #config;
  /** @type {null | import("telegraf").Telegraf<any>} */
  #bot = null;
  /** @type {null | import("aiwrapper").LanguageProvider} */
  #lang = null;
  /** @type {null | OpenAI} */
  #openai = null;
  /** @type {Map<string, Promise<void>>} */
  #processingThreads = new Map();
  /** @type {null | import("@sila/agents").InProcessChatAgentRuntime} */
  #agentRuntime = null;
  /** @type {string} */
  #landPath = process.cwd();
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

    console.log(`Starting Telegram channel at: ${this.#path}`);
    if (!this.#config.enabled) {
      console.log(`Telegram channel disabled at: ${this.#path}`);
      return;
    }

    if (!this.#config.botToken) {
      console.log(`Telegram channel missing bot token at ${this.#path}. Set botToken in channel config.`);
      return;
    }

    const openAiApiKey = await readOpenAiApiKey(this.#path);
    if (!openAiApiKey) {
      console.log(
        `Telegram channel missing OpenAI API key for ${this.#path}. Set providers/openai.json apiKey or OPENAI_API_KEY env.`,
      );
      return;
    }

    this.#lang = Lang.openai({ apiKey: openAiApiKey, model: this.#config.aiModel });
    this.#openai = new OpenAI({ apiKey: openAiApiKey });
    this.#landPath = path.resolve(this.#path, "..", "..");
    const skills = await loadSkillIndex(this.#landPath);
    const instructions = appendSkillCatalogInstructions(defaultTelegramInstructions(), skills);
    this.#agentRuntime = new InProcessChatAgentRuntime({
      lang: this.#lang,
      defaultCwd: this.#landPath,
      instructions,
    });

    const { Telegraf } = await import("telegraf");
    const bot = new Telegraf(this.#config.botToken, { handlerTimeout: 9 * 60 * 1000 });
    bot.catch((error) => {
      console.error("Telegram bot handler error:", error);
    });
    bot.on("text", async (ctx) => this.#handleTextMessage(ctx));
    bot.on("document", async (ctx) => this.#handleAttachmentMessage(ctx, "document"));
    bot.on("photo", async (ctx) => this.#handleAttachmentMessage(ctx, "photo"));
    bot.on("video", async (ctx) => this.#handleAttachmentMessage(ctx, "video"));
    bot.on("audio", async (ctx) => this.#handleAudioMessage(ctx, "audio"));
    bot.on("voice", async (ctx) => this.#handleAudioMessage(ctx, "voice"));

    await bot.launch();
    this.#bot = bot;
    this.#isRunning = true;
    console.log(`Telegram channel connected at: ${this.#path}`);
  }

  async stop() {
    if (!this.#bot && !this.#agentRuntime) {
      return;
    }

    await this.#agentRuntime?.stop();
    if (this.#bot) {
      this.#bot.stop("shutdown");
    }

    this.#bot = null;
    this.#lang = null;
    this.#openai = null;
    this.#agentRuntime = null;
    this.#processingThreads.clear();
    this.#isRunning = false;
    console.log(`Telegram channel stopped at: ${this.#path}`);
  }

  async sendMessage(chatId, text) {
    if (!this.#bot) {
      throw new Error(`Telegram channel is not connected: ${this.#path}`);
    }

    await this.#bot.telegram.sendMessage(chatId, text);
  }

  /**
   * @param {any} ctx
   */
  async #handleTextMessage(ctx) {
    try {
      if (!this.#bot || !this.#lang || !isTelegramUserTextMessage(ctx)) {
        return;
      }

      const text = getMessageText(ctx);
      if (!text) {
        return;
      }

      const userId = getUserId(ctx);
      if (!userId) {
        return;
      }

      const thread = getThreadContext(ctx);
      await this.#enqueueThread(thread.threadId, async () => {
        await this.#processThreadMessage(thread, userId, text, "text");
      });
    } catch (error) {
      console.error("Failed to process Telegram inbound message:", error);
    }
  }

  /**
   * @param {any} ctx
   * @param {"document" | "photo" | "video"} kind
   */
  async #handleAttachmentMessage(ctx, kind) {
    try {
      if (!this.#bot || !this.#lang || !isTelegramAttachmentMessage(ctx)) {
        return;
      }

      const userId = getUserId(ctx);
      if (!userId) {
        return;
      }

      const thread = getThreadContext(ctx);
      await this.#enqueueThread(thread.threadId, async () => {
        const attachment = getAttachmentInfo(ctx, kind);
        if (!attachment) {
          return;
        }

        const threadDir = path.join(this.#path, thread.threadId);
        const localPath = await this.#downloadTelegramFile({
          fileId: attachment.fileId,
          originalName: attachment.fileName,
          threadDir,
          createdAt: getMessageDate(ctx),
          telegram: ctx.telegram,
        });
        const relativePath = this.#toAgentRelativePath(localPath);
        let messageText = `[Uploaded a ${attachment.label}: ${relativePath}]`;
        const caption = getMessageCaption(ctx);
        if (caption) {
          messageText += `\n\n${caption}`;
        }

        await this.#processThreadMessage(thread, userId, messageText, "upload");
      });
    } catch (error) {
      console.error("Failed to process Telegram attachment:", error);
    }
  }

  /**
   * @param {any} ctx
   * @param {"audio" | "voice"} kind
   */
  async #handleAudioMessage(ctx, kind) {
    try {
      if (!this.#bot || !this.#lang || !isTelegramAudioMessage(ctx, kind)) {
        return;
      }

      const userId = getUserId(ctx);
      if (!userId) {
        return;
      }

      const thread = getThreadContext(ctx);
      await this.#enqueueThread(thread.threadId, async () => {
        const audioInfo = getAudioInfo(ctx, kind);
        if (!audioInfo) {
          return;
        }

        const threadDir = path.join(this.#path, thread.threadId);
        const localPath = await this.#downloadTelegramFile({
          fileId: audioInfo.fileId,
          originalName: audioInfo.fileName,
          threadDir,
          createdAt: getMessageDate(ctx),
          telegram: ctx.telegram,
        });
        const relativePath = this.#toAgentRelativePath(localPath);
        let messageText = `[Uploaded an audio file: ${relativePath}]`;

        try {
          const transcription = await this.#transcribeAudio(localPath);
          if (transcription) {
            messageText += `\n\n[Audio transcription]\n${transcription}`;
          }
        } catch (error) {
          console.error("Failed to transcribe Telegram audio:", error);
        }

        const caption = getMessageCaption(ctx);
        if (caption) {
          messageText += `\n\n${caption}`;
        }

        await this.#processThreadMessage(thread, userId, messageText, "audio");
      });
    } catch (error) {
      console.error("Failed to process Telegram audio:", error);
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
   * @param {{ threadId: string; chatId: string }} thread
   * @param {string} userId
   * @param {string} text
   * @param {"text" | "upload" | "audio"} inputType
   */
  async #processThreadMessage(thread, userId, text, inputType) {
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
    });

    await saveThreadState(threadDir, {
      chatId: thread.chatId,
      updatedAt: new Date().toISOString(),
      lastUserId: userId,
      inputType,
      responded: result.responded,
    });

    if (!result.responded || !result.answer) {
      return;
    }

    await this.sendMessage(thread.chatId, result.answer);
  }

  /**
   * @param {{
   *  fileId: string;
   *  originalName: string;
   *  threadDir: string;
   *  createdAt: Date;
   *  telegram: any;
   * }} input
   */
  async #downloadTelegramFile(input) {
    const datePath = buildDatePath(input.createdAt);
    const datedDir = path.join(input.threadDir, "files", datePath);
    await fs.mkdir(datedDir, { recursive: true });

    const safeName = sanitizeFileName(input.originalName);
    const targetPath = await buildUniqueFilePath(datedDir, safeName);
    const fileLink = await input.telegram.getFileLink(input.fileId);
    await downloadFileToPath(fileLink.href, targetPath);
    return targetPath;
  }

  /**
   * @param {string} localPath
   * @returns {Promise<string>}
   */
  async #transcribeAudio(localPath) {
    if (!this.#openai) {
      return "";
    }

    const transcription = await this.#openai.audio.transcriptions.create({
      file: fsSync.createReadStream(localPath),
      model: "whisper-1",
    });

    if (!transcription || typeof transcription.text !== "string") {
      return "";
    }

    return transcription.text.trim();
  }

  /**
   * @param {string} absolutePath
   */
  #toAgentRelativePath(absolutePath) {
    const relative = path.relative(this.#landPath, absolutePath);
    return relative.split(path.sep).join("/");
  }
}

function parseChannelConfig(rawConfig) {
  const result = TelegramChannelConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid Telegram channel config: ${details}`);
  }
  return result.data;
}

function isTelegramUserTextMessage(ctx) {
  if (!ctx || typeof ctx !== "object") {
    return false;
  }

  if (!ctx.message || typeof ctx.message !== "object") {
    return false;
  }

  if (typeof ctx.message.text !== "string") {
    return false;
  }

  if (ctx.from && typeof ctx.from === "object" && ctx.from.is_bot) {
    return false;
  }

  return true;
}

function isTelegramAttachmentMessage(ctx) {
  if (!ctx || typeof ctx !== "object") {
    return false;
  }
  if (!ctx.message || typeof ctx.message !== "object") {
    return false;
  }
  if (ctx.from && typeof ctx.from === "object" && ctx.from.is_bot) {
    return false;
  }
  return Boolean(ctx.message.document || ctx.message.photo || ctx.message.video);
}

function isTelegramAudioMessage(ctx, kind) {
  if (!ctx || typeof ctx !== "object") {
    return false;
  }
  if (!ctx.message || typeof ctx.message !== "object") {
    return false;
  }
  if (ctx.from && typeof ctx.from === "object" && ctx.from.is_bot) {
    return false;
  }
  if (kind === "audio") {
    return Boolean(ctx.message.audio);
  }
  return Boolean(ctx.message.voice);
}

function getMessageText(ctx) {
  return String(ctx.message.text || "").trim();
}

function getMessageCaption(ctx) {
  if (!ctx.message || typeof ctx.message.caption !== "string") {
    return "";
  }
  return ctx.message.caption.trim();
}

function getMessageDate(ctx) {
  const unixSeconds = Number(ctx.message?.date);
  if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
    return new Date(unixSeconds * 1000);
  }
  return new Date();
}

function getUserId(ctx) {
  if (!ctx.from || typeof ctx.from !== "object") {
    return "";
  }
  if (typeof ctx.from.id === "undefined" || ctx.from.id === null) {
    return "";
  }
  return String(ctx.from.id);
}

function getThreadContext(ctx) {
  const chatId = String(ctx.chat?.id ?? "");
  return {
    threadId: sanitizeThreadId(chatId),
    chatId,
  };
}

function getAttachmentInfo(ctx, kind) {
  if (!ctx.message || typeof ctx.message !== "object") {
    return null;
  }

  if (kind === "document" && ctx.message.document) {
    return {
      fileId: String(ctx.message.document.file_id),
      fileName: String(ctx.message.document.file_name || `file_${Date.now()}`),
      label: "file",
    };
  }

  if (kind === "photo" && Array.isArray(ctx.message.photo) && ctx.message.photo.length > 0) {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    return {
      fileId: String(photo.file_id),
      fileName: `photo_${Date.now()}.jpg`,
      label: "photo",
    };
  }

  if (kind === "video" && ctx.message.video) {
    return {
      fileId: String(ctx.message.video.file_id),
      fileName: String(ctx.message.video.file_name || `video_${Date.now()}.mp4`),
      label: "video",
    };
  }

  return null;
}

function getAudioInfo(ctx, kind) {
  if (!ctx.message || typeof ctx.message !== "object") {
    return null;
  }

  if (kind === "audio" && ctx.message.audio) {
    const fileName = String(ctx.message.audio.file_name || "").trim();
    const extension = path.extname(fileName) || ".mp3";
    return {
      fileId: String(ctx.message.audio.file_id),
      fileName: fileName || `audio_${Date.now()}${extension}`,
    };
  }

  if (kind === "voice" && ctx.message.voice) {
    return {
      fileId: String(ctx.message.voice.file_id),
      fileName: `voice_${Date.now()}.ogg`,
    };
  }

  return null;
}

function sanitizeThreadId(input) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sanitizeFileName(input) {
  const normalized = String(input || "").trim();
  if (!normalized) {
    return `file_${Date.now()}`;
  }

  const safe = normalized.replace(/[/\\]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe.length || safe === "." || safe === "..") {
    return `file_${Date.now()}`;
  }
  return safe;
}

function buildDatePath(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return path.join(year, month, day);
}

async function buildUniqueFilePath(directory, fileName) {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || "file";
  const extension = parsed.ext || "";

  let index = 0;
  while (true) {
    const suffix = index === 0 ? "" : `_${index}`;
    const candidateName = `${baseName}${suffix}${extension}`;
    const candidatePath = path.join(directory, candidateName);

    try {
      await fs.access(candidatePath);
      index += 1;
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return candidatePath;
      }
      throw error;
    }
  }
}

async function downloadFileToPath(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch Telegram file. status=${response.status}`);
  }

  const writeStream = fsSync.createWriteStream(destinationPath, { flags: "wx" });
  await pipeline(Readable.fromWeb(response.body), writeStream);
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

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(`Invalid OpenAI provider config at ${providerPath}:`, error.message);
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const value = parsed.apiKey;
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
