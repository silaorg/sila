import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { InProcessChatAgentRuntime } from "../agent-runtime/chat-agent-runtime.js";
import {
  OptionalTokenSchema,
  formatWorkingMessage,
  loadChannelLanguageProvider,
  loadChannelInstructions,
  loadChannelTools,
  readOpenAiApiKey,
  toAgentRelativePath,
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
import { TelegramTransport } from "./telegram/telegram-transport.js";
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
  /** @type {null | TelegramTransport} */
  #transport = null;
  /** @type {null | import("aiwrapper").LanguageProvider} */
  #lang = null;
  /** @type {null | any} */
  #openai = null;
  /** @type {null | import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime} */
  #agentRuntime = null;
  /** @type {ThreadedChannelRuntime} */
  #threadRuntime;
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
    this.#threadRuntime = new ThreadedChannelRuntime({ channelPath, channelName: "telegram" });
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

    const workspacePath = path.resolve(this.#path, "..", "..");
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
    const instructions = await loadChannelInstructions(workspacePath, "telegram");
    this.#agentRuntime = this.#dependencies.createAgentRuntime({
      lang: this.#lang,
      defaultCwd: workspacePath,
      instructions,
      loadInstructions: (input = {}) => loadChannelInstructions(workspacePath, "telegram", input.threadDir),
      loadTools: (input = {}) => loadChannelTools(workspacePath, "telegram", input),
    });
    this.#threadRuntime.setAgentRuntime(this.#agentRuntime);

    const bot = await this.#dependencies.createBot(this.#config.botToken);
    this.#bot = bot;
    this.#transport = new TelegramTransport(bot);
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

    this.#isRunning = true;
    void bot.launch({ dropPendingUpdates: false }).catch((error) => {
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

    this.#bot = null;
    this.#transport = null;
    this.#lang = null;
    this.#openai = null;
    this.#agentRuntime = null;
    this.#threadRuntime.clear();
    this.#isRunning = false;
    console.log(`Telegram channel stopped at: ${this.#path}`);
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

        const relativePath = toAgentRelativePath(localPath, threadDir);
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

        const relativePath = toAgentRelativePath(localPath, threadDir);
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
    if (!this.#lang || !this.#transport) {
      return;
    }

    const transport = this.#transport;
    let progressMessageId = null;
    const ensureProgressMessage = async () => {
      if (progressMessageId) {
        return progressMessageId;
      }

      const sent = await transport.sendMessage(thread.chatId, "🤔 Thinking...");
      progressMessageId = sent?.message_id ?? null;
      return progressMessageId;
    };

    await this.#threadRuntime.handleThreadMessage({
      thread,
      userId,
      text,
      agentInput: {
        sendTelegramFile: async (payload) => transport.sendFile(thread.chatId, payload),
      },
      state: (input) => ({
        chatId: thread.chatId,
        updatedAt: new Date().toISOString(),
        lastUserId: userId,
        inputType,
        responded: input.result.responded,
      }),
      onRespondStart: ensureProgressMessage,
      sendIntermediateReply: async (payload) => {
        const workingText = formatWorkingMessage(payload.text);
        const messageId = await ensureProgressMessage();
        if (messageId) {
          await transport.updateMessage(thread.chatId, messageId, workingText);
          return;
        }
        await transport.sendMessage(thread.chatId, workingText);
      },
      sendReply: async (answer) => {
        if (progressMessageId) {
          await transport.updateMessage(thread.chatId, progressMessageId, answer);
          return;
        }
        await transport.sendMessage(thread.chatId, answer);
      },
    });
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
