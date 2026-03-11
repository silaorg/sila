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
  /** @type {string} */
  #landPath;
  /** @type {Array<any>} */
  #customTools;
  /** @type {ThreadStore} */
  #threadStore;
  /** @type {undefined | ((payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>)} */
  #sendTelegramFile;
  /** @type {undefined | ((payload: { path?: string; files?: Array<{ path: string; filename?: string; title?: string }>; title?: string; comment?: string }) => Promise<any>)} */
  #sendSlackFile;

  /**
   * @param {{
   *  threadDir: string;
   *  threadId: string;
   *  lang: import("aiwrapper").LanguageProvider;
   *  ptyManager: PTYShellSessionManager;
   *  defaultCwd?: string;
   *  landPath?: string;
   *  customTools?: Array<any>;
   *  threadStore?: ThreadStore;
   *  sendTelegramFile?: (payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>;
   *  sendSlackFile?: (payload: { path?: string; files?: Array<{ path: string; filename?: string; title?: string }>; title?: string; comment?: string }) => Promise<any>;
   *  instructions: string;
   * }} options
   */
  constructor(options) {
    this.#threadDir = options.threadDir;
    this.#threadId = options.threadId;
    this.#lang = options.lang;
    this.#ptyManager = options.ptyManager;
    this.#defaultCwd = options.defaultCwd ?? process.cwd();
    this.#landPath = options.landPath ?? this.#defaultCwd;
    this.#customTools = Array.isArray(options.customTools) ? options.customTools : [];
    this.#threadStore = options.threadStore instanceof ThreadStore ? options.threadStore : new ThreadStore();
    this.#sendTelegramFile = options.sendTelegramFile;
    this.#sendSlackFile = options.sendSlackFile;
    this.#instructions = requireInstructions(options.instructions, "ThreadAgent");
  }

  /**
   * @param {{ userId: string; text: string }} input
   * @returns {Promise<{ responded: boolean; answer: string }>}
   */
  async processUserMessage(input) {
    const agent = await loadThreadAgent(this.#threadDir, this.#lang, {
      threadId: this.#threadId,
      ptyManager: this.#ptyManager,
      defaultCwd: this.#defaultCwd,
      landPath: this.#landPath,
      customTools: this.#customTools,
      threadStore: this.#threadStore,
      sendTelegramFile: this.#sendTelegramFile,
      sendSlackFile: this.#sendSlackFile,
    });
    agent.messages.instructions = this.#instructions;
    console.log(`[thread ${this.#threadId}] user <@${input.userId}>: ${input.text}`);
    agent.messages.addUserMessage(`<@${input.userId}>: ${input.text}`);
    await this.#threadStore.saveMessages(this.#threadDir, agent.messages);

    const shouldSendReply = await decideShouldRespond(this.#lang, agent);
    if (!shouldSendReply) {
      console.log(`[thread ${this.#threadId}] assistant: [no response]`);
      return { responded: false, answer: "" };
    }

    const result = await agent.run([]);
    await this.#threadStore.saveMessages(this.#threadDir, agent.messages);
    const answer = typeof result?.answer === "string" ? result.answer.trim() : "";
    console.log(`[thread ${this.#threadId}] assistant: ${answer}`);

    return {
      responded: true,
      answer,
    };
  }
}

/**
 * Backward-compatible alias. Prefer ThreadAgent for new code.
 */
export class SlackAgent extends ThreadAgent {}

export class InProcessChatAgentRuntime {
  /** @type {import("aiwrapper").LanguageProvider} */
  #lang;
  /** @type {string} */
  #instructions;
  /** @type {null | ((input: { threadId: string; threadDir: string }) => Promise<string>)} */
  #loadInstructions = null;
  /** @type {null | ((input: { threadId: string; threadDir: string }) => Promise<Array<any>>)} */
  #loadTools = null;
  /** @type {string} */
  #defaultCwd;
  /** @type {ThreadStore} */
  #threadStore;
  /** @type {Map<string, PTYShellSessionManager>} */
  #ptyManagersByThread = new Map();

  /**
   * @param {{
   *  lang: import("aiwrapper").LanguageProvider;
   *  instructions: string;
   *  loadInstructions?: (input: { threadId: string; threadDir: string }) => Promise<string>;
   *  loadTools?: (input: { threadId: string; threadDir: string }) => Promise<Array<any>>;
   *  defaultCwd?: string;
   *  threadStore?: ThreadStore;
   * }} options
   */
  constructor(options) {
    this.#lang = options.lang;
    this.#defaultCwd = options.defaultCwd ?? process.cwd();
    this.#threadStore = options.threadStore instanceof ThreadStore ? options.threadStore : new ThreadStore();
    this.#instructions = requireInstructions(options.instructions, "InProcessChatAgentRuntime");
    if (typeof options.loadInstructions === "function") {
      this.#loadInstructions = options.loadInstructions;
    }
    if (typeof options.loadTools === "function") {
      this.#loadTools = options.loadTools;
    }
  }

  /**
   * @param {{
   *  threadId: string;
   *  threadDir: string;
   *  userId: string;
   *  text: string;
   *  sendTelegramFile?: (payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>;
   *  sendSlackFile?: (payload: { path?: string; files?: Array<{ path: string; filename?: string; title?: string }>; title?: string; comment?: string }) => Promise<any>;
   * }} input
   * @returns {Promise<{ responded: boolean; answer: string }>}
   */
  async handleThreadMessage(input) {
    const ptyManager = this.#getOrCreatePtyManager(input.threadId, input.threadDir);
    const instructions = await this.#resolveInstructions({
      threadId: input.threadId,
      threadDir: input.threadDir,
    });
    const customTools = await this.#resolveTools({
      threadId: input.threadId,
      threadDir: input.threadDir,
    });

    const agent = new ThreadAgent({
      threadId: input.threadId,
      threadDir: input.threadDir,
      lang: this.#lang,
      ptyManager,
      defaultCwd: input.threadDir,
      landPath: this.#defaultCwd,
      customTools,
      threadStore: this.#threadStore,
      sendTelegramFile: input.sendTelegramFile,
      sendSlackFile: input.sendSlackFile,
      instructions,
    });
    return agent.processUserMessage({
      userId: input.userId,
      text: input.text,
    });
  }

  async #resolveInstructions(input) {
    if (!this.#loadInstructions) {
      return this.#instructions;
    }

    const loaded = await this.#loadInstructions(input);
    this.#instructions = requireInstructions(loaded, "InProcessChatAgentRuntime.loadInstructions");
    return this.#instructions;
  }

  async #resolveTools(input) {
    if (!this.#loadTools) {
      return [];
    }

    const loaded = await this.#loadTools(input);
    return Array.isArray(loaded) ? loaded : [];
  }

  async stop() {
    const managers = Array.from(this.#ptyManagersByThread.values());
    this.#ptyManagersByThread.clear();
    await Promise.all(managers.map((manager) => manager.stopAll()));
  }

  #getOrCreatePtyManager(threadId, defaultCwd = this.#defaultCwd) {
    const key = String(threadId);
    const existing = this.#ptyManagersByThread.get(key);
    if (existing) {
      return existing;
    }

    const manager = new PTYShellSessionManager({ defaultCwd });
    this.#ptyManagersByThread.set(key, manager);
    return manager;
  }
}

function requireInstructions(instructions, contextName) {
  if (typeof instructions !== "string" || !instructions.trim().length) {
    throw new Error(`${contextName} requires explicit non-empty instructions.`);
  }
  return instructions;
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
