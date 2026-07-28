import { z as aiZ } from "aiwrapper";
import { PTYShellSessionManager } from "./pty-shell-session-manager.js";
import { createChatAgent } from "./chat-agent.js";
import { ThreadStore } from "./thread-store.js";

export class ThreadAgent {
  /** @type {string} */
  #threadDir;
  /** @type {import("aiwrapper").LanguageProvider} */
  #lang;
  /** @type {string} */
  #instructions;
  /** @type {string} */
  #threadId;
  /** @type {PTYShellSessionManager} */
  #ptyManager;
  /** @type {string} */
  #defaultCwd;
  /** @type {Array<any>} */
  #customTools;
  /** @type {Record<string, string>} */
  #environment;
  /** @type {ThreadStore} */
  #threadStore;
  /** @type {undefined | ((payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>)} */
  #sendTelegramFile;
  /** @type {undefined | ((payload: { path?: string; files?: Array<{ path: string; filename?: string; title?: string }>; title?: string; comment?: string }) => Promise<any>)} */
  #sendSlackFile;
  /** @type {undefined | ((payload: { text: string; toolNames: string[] }) => Promise<void>)} */
  #onAssistantLoopMessage;
  /** @type {undefined | (() => Promise<void>)} */
  #onAssistantResponding;
  /** @type {boolean} */
  #alwaysRespond;

  /**
   * @param {{
   *  threadDir: string;
   *  threadId: string;
   *  lang: import("aiwrapper").LanguageProvider;
   *  ptyManager: PTYShellSessionManager;
   *  defaultCwd?: string;
   *  customTools?: Array<any>;
   *  environment?: Record<string, string>;
   *  threadStore?: ThreadStore;
   *  sendTelegramFile?: (payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>;
   *  sendSlackFile?: (payload: { path?: string; files?: Array<{ path: string; filename?: string; title?: string }>; title?: string; comment?: string }) => Promise<any>;
   *  onAssistantLoopMessage?: (payload: { text: string; toolNames: string[] }) => Promise<void>;
   *  onAssistantResponding?: () => Promise<void>;
   *  alwaysRespond?: boolean;
   *  instructions: string;
   * }} options
   */
  constructor(options) {
    this.#threadDir = options.threadDir;
    this.#threadId = options.threadId;
    this.#lang = options.lang;
    this.#ptyManager = options.ptyManager;
    this.#defaultCwd = options.defaultCwd ?? process.cwd();
    this.#customTools = Array.isArray(options.customTools) ? options.customTools : [];
    this.#environment = normalizeEnvironment(options.environment);
    this.#threadStore = options.threadStore instanceof ThreadStore ? options.threadStore : new ThreadStore();
    this.#sendTelegramFile = options.sendTelegramFile;
    this.#sendSlackFile = options.sendSlackFile;
    this.#onAssistantLoopMessage = typeof options.onAssistantLoopMessage === "function"
      ? options.onAssistantLoopMessage
      : undefined;
    this.#onAssistantResponding = typeof options.onAssistantResponding === "function"
      ? options.onAssistantResponding
      : undefined;
    this.#alwaysRespond = options.alwaysRespond === true;
    this.#instructions = requireInstructions(options.instructions, "ThreadAgent");
  }

  /**
   * @param {{ userId: string; text: string; publicText?: string; attachments?: Array<Record<string, unknown>> }} input
   * @returns {Promise<{ responded: boolean; answer: string }>}
   */
  async processUserMessage(input) {
    const agent = await loadThreadAgent(this.#threadDir, this.#lang, {
      threadId: this.#threadId,
      ptyManager: this.#ptyManager,
      defaultCwd: this.#defaultCwd,
      customTools: this.#customTools,
      environment: this.#environment,
      threadStore: this.#threadStore,
      sendTelegramFile: this.#sendTelegramFile,
      sendSlackFile: this.#sendSlackFile,
    });
    agent.messages.instructions = this.#instructions;
    console.log(
      `[thread ${this.#threadId}] user message received (${input.text.length} chars)`,
    );
    agent.messages.addUserMessage(`<@${input.userId}>: ${input.text}`);
    const userMessage = agent.messages[agent.messages.length - 1];
    if (input.publicText !== undefined || input.attachments?.length) {
      userMessage.meta = {
        ...(userMessage.meta ?? {}),
        app: {
          text: input.publicText ?? input.text,
          attachments: Array.isArray(input.attachments) ? input.attachments : [],
        },
      };
    }
    await this.#threadStore.appendMessages(this.#threadDir, [
      userMessage,
    ]);

    const shouldSendReply = this.#alwaysRespond
      || await decideShouldRespond(this.#lang, agent);
    if (!shouldSendReply) {
      console.log(`[thread ${this.#threadId}] assistant: [no response]`);
      return { responded: false, answer: "" };
    }

    if (this.#onAssistantResponding) {
      await this.#onAssistantResponding();
    }

    const loopLogger = subscribeToAgentLoopLogs(this.#threadId, agent, this.#onAssistantLoopMessage);
    const persistedMessageCount = agent.messages.length;
    let result;
    try {
      result = await agent.run([]);
    } catch (error) {
      loopLogger.flushPending();
      throw error;
    } finally {
      loopLogger.unsubscribe();
      await this.#threadStore.appendMessages(
        this.#threadDir,
        agent.messages.slice(persistedMessageCount),
      );
    }
    await loopLogger.waitForPending();
    const answer = typeof result?.answer === "string" ? result.answer.trim() : "";
    console.log(
      `[thread ${this.#threadId}] assistant response completed (${answer.length} chars)`,
    );

    return {
      responded: true,
      answer,
    };
  }
}

export class InProcessChatAgentRuntime {
  /** @type {import("aiwrapper").LanguageProvider} */
  #lang;
  /** @type {string} */
  #instructions;
  /** @type {null | ((input: { threadId: string; threadDir: string }) => Promise<string>)} */
  #loadInstructions = null;
  /** @type {null | ((input: { threadId: string; threadDir: string }) => Promise<Array<any>>)} */
  #loadTools = null;
  /** @type {null | ((input: { threadId: string; threadDir: string }) => Promise<Record<string, string>>)} */
  #loadEnvironment = null;
  /** @type {string} */
  #defaultCwd;
  /** @type {ThreadStore} */
  #threadStore;
  /** @type {boolean} */
  #alwaysRespond;
  /** @type {Map<string, PTYShellSessionManager>} */
  #ptyManagersByThread = new Map();

  /**
   * @param {{
   *  lang: import("aiwrapper").LanguageProvider;
   *  instructions: string;
   *  loadInstructions?: (input: { threadId: string; threadDir: string }) => Promise<string>;
   *  loadTools?: (input: { threadId: string; threadDir: string }) => Promise<Array<any>>;
   *  loadEnvironment?: (input: { threadId: string; threadDir: string }) => Promise<Record<string, string>>;
   *  defaultCwd?: string;
   *  threadStore?: ThreadStore;
   *  alwaysRespond?: boolean;
   * }} options
   */
  constructor(options) {
    this.#lang = options.lang;
    this.#defaultCwd = options.defaultCwd ?? process.cwd();
    this.#threadStore = options.threadStore instanceof ThreadStore ? options.threadStore : new ThreadStore();
    this.#alwaysRespond = options.alwaysRespond === true;
    this.#instructions = requireInstructions(options.instructions, "InProcessChatAgentRuntime");
    if (typeof options.loadInstructions === "function") {
      this.#loadInstructions = options.loadInstructions;
    }
    if (typeof options.loadTools === "function") {
      this.#loadTools = options.loadTools;
    }
    if (typeof options.loadEnvironment === "function") {
      this.#loadEnvironment = options.loadEnvironment;
    }
  }

  /**
   * @param {{
   *  threadId: string;
   *  threadDir: string;
   *  userId: string;
   *  text: string;
   *  publicText?: string;
   *  attachments?: Array<Record<string, unknown>>;
   *  sendTelegramFile?: (payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>;
   *  sendSlackFile?: (payload: { path?: string; files?: Array<{ path: string; filename?: string; title?: string }>; title?: string; comment?: string }) => Promise<any>;
   *  onAssistantLoopMessage?: (payload: { text: string; toolNames: string[] }) => Promise<void>;
   *  onAssistantResponding?: () => Promise<void>;
   * }} input
   * @returns {Promise<{ responded: boolean; answer: string }>}
   */
  async handleThreadMessage(input) {
    this.#pruneInactivePtyManagers();
    const runtimeInput = {
      threadId: input.threadId,
      threadDir: input.threadDir,
    };
    const [instructions, customTools, environment] = await Promise.all([
      this.#resolveInstructions(runtimeInput),
      this.#resolveTools(runtimeInput),
      this.#resolveEnvironment(runtimeInput),
    ]);
    const ptyManager = this.#getOrCreatePtyManager(
      input.threadId,
      input.threadDir,
      environment,
    );

    try {
      const agent = new ThreadAgent({
        threadId: input.threadId,
        threadDir: input.threadDir,
        lang: this.#lang,
        ptyManager,
        defaultCwd: input.threadDir,
        customTools,
        environment,
        threadStore: this.#threadStore,
        sendTelegramFile: input.sendTelegramFile,
        sendSlackFile: input.sendSlackFile,
        onAssistantLoopMessage: input.onAssistantLoopMessage,
        onAssistantResponding: input.onAssistantResponding,
        alwaysRespond: this.#alwaysRespond,
        instructions,
      });
      return await agent.processUserMessage({
        userId: input.userId,
        text: input.text,
        publicText: input.publicText,
        attachments: input.attachments,
      });
    } finally {
      if (
        !ptyManager.hasActiveSessions()
        && this.#ptyManagersByThread.get(String(input.threadId)) === ptyManager
      ) {
        this.#ptyManagersByThread.delete(String(input.threadId));
      }
    }
  }

  async #resolveInstructions(input) {
    if (!this.#loadInstructions) {
      return this.#instructions;
    }

    const loaded = await this.#loadInstructions(input);
    return requireInstructions(loaded, "InProcessChatAgentRuntime.loadInstructions");
  }

  async #resolveTools(input) {
    if (!this.#loadTools) {
      return [];
    }

    const loaded = await this.#loadTools(input);
    return Array.isArray(loaded) ? loaded : [];
  }

  async #resolveEnvironment(input) {
    if (!this.#loadEnvironment) {
      return {};
    }
    return normalizeEnvironment(await this.#loadEnvironment(input));
  }

  async stop() {
    const managers = Array.from(this.#ptyManagersByThread.values());
    this.#ptyManagersByThread.clear();
    await Promise.all(managers.map((manager) => manager.stopAll()));
  }

  #getOrCreatePtyManager(
    threadId,
    defaultCwd = this.#defaultCwd,
    environment = {},
  ) {
    const key = String(threadId);
    const existing = this.#ptyManagersByThread.get(key);
    if (existing) {
      return existing;
    }

    const manager = new PTYShellSessionManager({ defaultCwd, environment });
    this.#ptyManagersByThread.set(key, manager);
    return manager;
  }

  #pruneInactivePtyManagers() {
    for (const [threadId, manager] of this.#ptyManagersByThread) {
      if (!manager.hasActiveSessions()) {
        this.#ptyManagersByThread.delete(threadId);
      }
    }
  }
}

function normalizeEnvironment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([name, entry]) => name && typeof entry === "string"),
  );
}

function requireInstructions(instructions, contextName) {
  if (typeof instructions !== "string" || !instructions.trim().length) {
    throw new Error(`${contextName} requires explicit non-empty instructions.`);
  }
  return instructions;
}

function subscribeToAgentLoopLogs(threadId, agent, onAssistantLoopMessage) {
  let pendingAssistantIdx = null;
  let pendingAssistantMessage = null;
  let pendingLoopSends = Promise.resolve();

  function flushPending() {
    if (pendingAssistantMessage == null) {
      return;
    }

    const payload = getIntermediateAssistantPayload(pendingAssistantMessage);
    pendingAssistantIdx = null;
    pendingAssistantMessage = null;

    if (!payload) {
      return;
    }

    console.log(formatIntermediateAssistantLog(threadId, payload));
    if (typeof onAssistantLoopMessage === "function") {
      pendingLoopSends = pendingLoopSends
        .then(() => onAssistantLoopMessage(payload))
        .catch((error) => {
          console.error(`[thread ${threadId}] failed to send assistant loop message:`, error);
        });
    }
  }

  const unsubscribe = agent.subscribe((event) => {
    if (event?.type !== "streaming") {
      return;
    }

    const streamIdx = Number(event.data?.idx);
    const message = event.data?.msg;

    if (pendingAssistantMessage != null && streamIdx !== pendingAssistantIdx) {
      flushPending();
    }

    if (message?.role !== "assistant") {
      return;
    }

    pendingAssistantIdx = streamIdx;
    pendingAssistantMessage = message;
  });

  return {
    unsubscribe,
    flushPending,
    waitForPending() {
      return pendingLoopSends;
    },
  };
}

function getIntermediateAssistantPayload(message) {
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  if (!text) {
    return null;
  }

  const toolNames = Array.isArray(message.toolRequests)
    ? message.toolRequests.map((tool) => tool?.name).filter(Boolean)
    : [];
  return { text, toolNames };
}

function formatIntermediateAssistantLog(threadId, payload) {
  const { text, toolNames } = payload;
  const toolSuffix = toolNames.length ? ` [tools: ${toolNames.join(", ")}]` : "";
  return `[thread ${threadId}] assistant loop (${text.length} chars)${toolSuffix}`;
}

async function decideShouldRespond(lang, agent) {
  if (!lang || agent.messages.length === 0) {
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
    const decision = await lang.askForObject(decisionPrompt, decisionSchema);
    return Boolean(decision?.object?.respond);
  } catch (error) {
    console.error("Failed to run respond/no-respond decision; defaulting to respond:", error);
    return true;
  }
}

async function loadThreadAgent(threadDir, lang, options) {
  const agent = createChatAgent(lang, options);
  const threadStore = options.threadStore instanceof ThreadStore ? options.threadStore : new ThreadStore();
  const messages = await threadStore.loadMessages(threadDir);
  if (messages.length > 0) {
    agent.messages.push(...messages);
  }
  return agent;
}
