import fs from "node:fs/promises";
import path from "node:path";
import { Lang } from "aiwrapper";
import OpenAI from "openai";
import { z } from "zod";
import { InProcessChatAgentRuntime, defaultTelegramInstructions } from "@sila/agents";
import { appendSkillCatalogInstructions, loadSkillIndex } from "../skills.js";
import { OptionalTokenSchema, enqueueSerialTask, readOpenAiApiKey, saveThreadState } from "./channel-utils.js";
import {
  getAttachmentInfo,
  getAudioInfo,
  getMessageCaption,
  getMessageDate,
  getMessageText,
  getThreadContext,
  getUserId,
  isTelegramAttachmentMessage,
  isTelegramAudioMessage,
  isTelegramUserTextMessage,
} from "./telegram/telegram-input-parser.js";
import { storeTelegramFile } from "./telegram/telegram-file-store.js";
import { transcribeAudioFile } from "./telegram/telegram-transcriber.js";

const TelegramChannelConfigSchema = z.looseObject({
  channel: z.literal("telegram"),
  enabled: z.boolean().default(true),
  botToken: OptionalTokenSchema,
  aiModel: z.string().min(1).default("gpt-5.2"),
});

export class TelegramChannel {
  /** @type {string} */
  #path;
  /** @type {import("zod").infer<typeof TelegramChannelConfigSchema>} */
  #config;
  /** @type {null | any} */
  #bot = null;
  /** @type {null | import("aiwrapper").LanguageProvider} */
  #lang = null;
  /** @type {null | any} */
  #openai = null;
  /** @type {Map<string, Promise<void>>} */
  #processingThreads = new Map();
  /** @type {null | import("@sila/agents").InProcessChatAgentRuntime} */
  #agentRuntime = null;
  /** @type {string} */
  #landPath = process.cwd();
  #isRunning = false;
  /** @type {{
   *  createBot: (token: string) => Promise<any>;
   *  createOpenAiClient: (apiKey: string) => any;
   *  createAgentRuntime: (options: { lang: import("aiwrapper").LanguageProvider; instructions: string; defaultCwd: string }) => import("@sila/agents").InProcessChatAgentRuntime;
   *  storeTelegramFile: typeof storeTelegramFile;
   *  transcribeAudioFile: typeof transcribeAudioFile;
   * }} */
  #dependencies;

  /**
   * @param {string} channelPath
   * @param {Record<string, unknown>} rawConfig
   * @param {Partial<{
   *  createBot: (token: string) => Promise<any>;
   *  createOpenAiClient: (apiKey: string) => any;
   *  createAgentRuntime: (options: { lang: import("aiwrapper").LanguageProvider; instructions: string; defaultCwd: string }) => import("@sila/agents").InProcessChatAgentRuntime;
   *  storeTelegramFile: typeof storeTelegramFile;
   *  transcribeAudioFile: typeof transcribeAudioFile;
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
    this.#openai = this.#dependencies.createOpenAiClient(openAiApiKey);
    this.#landPath = path.resolve(this.#path, "..", "..");
    const skills = await loadSkillIndex(this.#landPath);
    const instructions = appendSkillCatalogInstructions(defaultTelegramInstructions(), skills);
    this.#agentRuntime = this.#dependencies.createAgentRuntime({
      lang: this.#lang,
      defaultCwd: this.#landPath,
      instructions,
    });

    const bot = await this.#dependencies.createBot(this.#config.botToken);
    if (typeof bot.catch === "function") {
      bot.catch((error) => {
        console.error("Telegram bot handler error:", error);
      });
    }

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
    if (this.#bot && typeof this.#bot.stop === "function") {
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
        const localPath = await this.#dependencies.storeTelegramFile({
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
        const localPath = await this.#dependencies.storeTelegramFile({
          fileId: audioInfo.fileId,
          originalName: audioInfo.fileName,
          threadDir,
          createdAt: getMessageDate(ctx),
          telegram: ctx.telegram,
        });

        const relativePath = this.#toAgentRelativePath(localPath);
        let messageText = `[Uploaded an audio file: ${relativePath}]`;

        try {
          const transcription = await this.#dependencies.transcribeAudioFile(this.#openai, localPath);
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
    await enqueueSerialTask(this.#processingThreads, threadId, task);
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

function createDefaultDependencies() {
  return {
    async createBot(botToken) {
      const { Telegraf } = await import("telegraf");
      return new Telegraf(botToken, { handlerTimeout: 9 * 60 * 1000 });
    },
    createOpenAiClient(apiKey) {
      return new OpenAI({ apiKey });
    },
    createAgentRuntime(options) {
      return new InProcessChatAgentRuntime(options);
    },
    storeTelegramFile,
    transcribeAudioFile,
  };
}
