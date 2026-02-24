import fs from "node:fs/promises";
import path from "node:path";
import { LangMessage, z as aiZ } from "aiwrapper";
import { PTYShellSessionManager } from "./pty-shell-session-manager.js";
import { createChatAgent } from "./chat-agent.js";

const THREAD_MESSAGES_FILE_NAME = "messages.json";

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
  /** @type {undefined | ((payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>)} */
  #sendTelegramFile;

  /**
   * @param {{
   *  threadDir: string;
   *  threadId: string;
   *  lang: import("aiwrapper").LanguageProvider;
   *  ptyManager: PTYShellSessionManager;
   *  defaultCwd?: string;
   *  sendTelegramFile?: (payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>;
   *  instructions: string;
   * }} options
   */
  constructor(options) {
    this.#threadDir = options.threadDir;
    this.#threadId = options.threadId;
    this.#lang = options.lang;
    this.#ptyManager = options.ptyManager;
    this.#defaultCwd = options.defaultCwd ?? process.cwd();
    this.#sendTelegramFile = options.sendTelegramFile;
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
      sendTelegramFile: this.#sendTelegramFile,
    });
    agent.messages.instructions = this.#instructions;
    agent.messages.addUserMessage(`<@${input.userId}>: ${input.text}`);
    await saveThreadMessages(this.#threadDir, agent.messages);

    const shouldSendReply = await decideShouldRespond(this.#lang, agent);
    if (!shouldSendReply) {
      return { responded: false, answer: "" };
    }

    const result = await agent.run([]);
    await saveThreadMessages(this.#threadDir, agent.messages);

    return {
      responded: true,
      answer: typeof result?.answer === "string" ? result.answer.trim() : "",
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
  /** @type {string} */
  #defaultCwd;
  /** @type {Map<string, PTYShellSessionManager>} */
  #ptyManagersByThread = new Map();

  /**
   * @param {{ lang: import("aiwrapper").LanguageProvider; instructions: string; defaultCwd?: string }} options
   */
  constructor(options) {
    this.#lang = options.lang;
    this.#defaultCwd = options.defaultCwd ?? process.cwd();
    this.#instructions = requireInstructions(options.instructions, "InProcessChatAgentRuntime");
  }

  /**
   * @param {{
   *  threadId: string;
   *  threadDir: string;
   *  userId: string;
   *  text: string;
   *  sendTelegramFile?: (payload: { path: string; kind: "photo" | "video" | "audio" | "voice" | "document"; caption?: string }) => Promise<any>;
   * }} input
   * @returns {Promise<{ responded: boolean; answer: string }>}
   */
  async handleThreadMessage(input) {
    const ptyManager = this.#getOrCreatePtyManager(input.threadId);

    const agent = new ThreadAgent({
      threadId: input.threadId,
      threadDir: input.threadDir,
      lang: this.#lang,
      ptyManager,
      defaultCwd: this.#defaultCwd,
      sendTelegramFile: input.sendTelegramFile,
      instructions: this.#instructions,
    });
    return agent.processUserMessage({
      userId: input.userId,
      text: input.text,
    });
  }

  async stop() {
    const managers = Array.from(this.#ptyManagersByThread.values());
    this.#ptyManagersByThread.clear();
    await Promise.all(managers.map((manager) => manager.stopAll()));
  }

  #getOrCreatePtyManager(threadId) {
    const key = String(threadId);
    const existing = this.#ptyManagersByThread.get(key);
    if (existing) {
      return existing;
    }

    const manager = new PTYShellSessionManager({ defaultCwd: this.#defaultCwd });
    this.#ptyManagersByThread.set(key, manager);
    return manager;
  }
}

/**
 * Backward-compatible alias. Use InProcessChatAgentRuntime for new code.
 */
export class InProcessSlackAgentRuntime extends InProcessChatAgentRuntime {}

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
