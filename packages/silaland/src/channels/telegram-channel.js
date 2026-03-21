import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { Input } from "telegraf";
import { z } from "zod";
import { InProcessChatAgentRuntime } from "../agent-runtime/chat-agent-runtime.js";
import {
  OptionalTokenSchema,
  loadChannelLanguageProvider,
  loadChannelInstructions,
  loadChannelTools,
  readOpenAiApiKey,
} from "./channel-utils.js";
import {
  getAttachmentInfo,
  getAudioInfo,
  getMessageCaption,
  getMessageDate,
  getMessageText,
  prependReplyContext,
  getThreadContext,
  getUserId,
  isTelegramAttachmentMessage,
  isTelegramAudioMessage,
  isTelegramUserTextMessage,
} from "./telegram/telegram-input-parser.js";
import { storeTelegramFile } from "./telegram/telegram-file-store.js";
import { transcribeAudioFile } from "./telegram/telegram-transcriber.js";
import { ThreadedChannelRuntime } from "./threaded-channel-runtime.js";

const TelegramChannelConfigSchema = z.looseObject({
  channel: z.literal("telegram"),
  enabled: z.boolean().default(true),
  botToken: OptionalTokenSchema,
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
  /** @type {null | import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime} */
  #agentRuntime = null;
  /** @type {ThreadedChannelRuntime} */
  #threadRuntime;
  /** @type {null | Promise<void>} */
  #launchPromise = null;
  #isRunning = false;
  /** @type {{
   *  createBot: (token: string) => Promise<any>;
   *  createOpenAiClient: (apiKey: string) => any;
   *  createAgentRuntime: (options: {
   *    lang: import("aiwrapper").LanguageProvider;
   *    instructions: string;
   *    loadInstructions?: (input: { threadId: string; threadDir: string }) => Promise<string>;
   *    loadTools?: (input: { threadId: string; threadDir: string }) => Promise<Array<any>>;
   *    defaultCwd: string;
   *  }) => import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime;
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
   *  createAgentRuntime: (options: {
   *    lang: import("aiwrapper").LanguageProvider;
   *    instructions: string;
   *    loadInstructions?: (input: { threadId: string; threadDir: string }) => Promise<string>;
   *    loadTools?: (input: { threadId: string; threadDir: string }) => Promise<Array<any>>;
   *    defaultCwd: string;
   *  }) => import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime;
   *  storeTelegramFile: typeof storeTelegramFile;
   *  transcribeAudioFile: typeof transcribeAudioFile;
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

    console.log(`Starting Telegram channel at: ${this.#path}`);
    if (!this.#config.enabled) {
      console.log(`Telegram channel disabled at: ${this.#path}`);
      return;
    }

    if (!this.#config.botToken) {
      console.log(`Telegram channel missing bot token at ${this.#path}. Set botToken in channel config.`);
      return;
    }

    const landPath = path.resolve(this.#path, "..", "..");
    let languageProvider;
    try {
      languageProvider = await loadChannelLanguageProvider(this.#path);
    } catch (error) {
      console.log(`Telegram channel ${error.message}`);
      return;
    }

    this.#lang = languageProvider.lang;
    const openAiApiKey = await readOpenAiApiKey(this.#path);
    this.#openai = openAiApiKey ? this.#dependencies.createOpenAiClient(openAiApiKey) : null;
    const instructions = await loadChannelInstructions(landPath, "telegram");
    this.#agentRuntime = this.#dependencies.createAgentRuntime({
      lang: this.#lang,
      defaultCwd: landPath,
      instructions,
      loadInstructions: (input = {}) => loadChannelInstructions(landPath, "telegram", input.threadDir),
      loadTools: (input = {}) => loadChannelTools(landPath, "telegram", input),
    });
    this.#threadRuntime.setAgentRuntime(this.#agentRuntime);

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

    const botInfo = await bot.telegram.getMe();
    const botIdentity = botInfo?.username ? `@${botInfo.username}` : `id=${botInfo?.id ?? "unknown"}`;
    console.log(`Telegram bot authenticated as ${botIdentity}.`);

    this.#bot = bot;
    this.#isRunning = true;
    this.#launchPromise = bot.launch({ dropPendingUpdates: false }).catch((error) => {
      console.error("Telegram channel launch failed:", error);
    });
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

    this.#launchPromise = null;
    this.#bot = null;
    this.#lang = null;
    this.#openai = null;
    this.#agentRuntime = null;
    this.#threadRuntime.clear();
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
      const textWithReplyContext = prependReplyContext(ctx, text);

      const userId = getUserId(ctx);
      if (!userId) {
        return;
      }

      const thread = getThreadContext(ctx);
      await this.#threadRuntime.enqueue(thread.threadId, async () => {
        await this.#processThreadMessage(thread, userId, textWithReplyContext, "text");
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
      await this.#threadRuntime.enqueue(thread.threadId, async () => {
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

        const relativePath = this.#toAgentRelativePath(localPath, threadDir);
        let messageText = `[Uploaded a ${attachment.label}: ${relativePath}]`;
        const caption = getMessageCaption(ctx);
        if (caption) {
          messageText += `\n\n${caption}`;
        }
        messageText = prependReplyContext(ctx, messageText);

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
      await this.#threadRuntime.enqueue(thread.threadId, async () => {
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

        const relativePath = this.#toAgentRelativePath(localPath, threadDir);
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
        messageText = prependReplyContext(ctx, messageText);

        await this.#processThreadMessage(thread, userId, messageText, "audio");
      });
    } catch (error) {
      console.error("Failed to process Telegram audio:", error);
    }
  }

  /**
   * @param {{ threadId: string; chatId: string }} thread
   * @param {string} userId
   * @param {string} text
   * @param {"text" | "upload" | "audio"} inputType
   */
  async #processThreadMessage(thread, userId, text, inputType) {
    if (!this.#lang) {
      return;
    }

    await this.#threadRuntime.handleThreadMessage({
      thread,
      userId,
      text,
      agentInput: {
        sendTelegramFile: async (payload) => this.#sendTelegramFile(thread.chatId, payload),
      },
      state: (input) => ({
        chatId: thread.chatId,
        updatedAt: new Date().toISOString(),
        lastUserId: userId,
        inputType,
        responded: input.result.responded,
      }),
      sendIntermediateReply: async (payload) => this.sendMessage(thread.chatId, payload.text),
      sendReply: async (answer) => this.sendMessage(thread.chatId, answer),
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

  /**
   * @param {string} chatId
   * @param {{ path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }} payload
   */
  async #sendTelegramFile(chatId, payload) {
    if (!this.#bot) {
      throw new Error(`Telegram channel is not connected: ${this.#path}`);
    }

    const { path: filePath, kind, caption } = payload;
    const input = Input.fromLocalFile(filePath);
    const extra = caption ? { caption } : undefined;

    if (kind === "photo") {
      const sent = await this.#bot.telegram.sendPhoto(chatId, input, extra);
      return { messageId: sent?.message_id ?? null };
    }

    if (kind === "video") {
      const sent = await this.#bot.telegram.sendVideo(chatId, input, extra);
      return { messageId: sent?.message_id ?? null };
    }

    if (kind === "audio") {
      const sent = await this.#bot.telegram.sendAudio(chatId, input, extra);
      return { messageId: sent?.message_id ?? null };
    }

    if (kind === "voice") {
      const sent = await this.#bot.telegram.sendVoice(chatId, input, extra);
      return { messageId: sent?.message_id ?? null };
    }

    const sent = await this.#bot.telegram.sendDocument(chatId, input, extra);
    return { messageId: sent?.message_id ?? null };
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
