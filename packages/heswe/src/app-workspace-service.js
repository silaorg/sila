import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { InProcessChatAgentRuntime } from "./agent-runtime/chat-agent-runtime.js";
import { ThreadStore } from "./agent-runtime/thread-store.js";
import {
  loadChannelInstructions,
  loadChannelTools,
} from "./channels/channel-utils.js";
import { readConfig } from "./config.js";
import { loadWorkspaceLanguageProvider } from "./providers.js";

const MAX_MESSAGE_LENGTH = 50_000;
const MAX_TITLE_LENGTH = 100;
const THREAD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export class AppWorkspaceService {
  #workspacePath;
  #threadStore;
  #createAgentRuntime;
  #agentRuntimePromise = null;
  #onChange;
  #queues = new Map();

  constructor(options) {
    if (!options?.workspacePath) {
      throw new Error("AppWorkspaceService requires workspacePath.");
    }
    this.#workspacePath = path.resolve(options.workspacePath);
    this.#threadStore = options.threadStore instanceof ThreadStore
      ? options.threadStore
      : new ThreadStore();
    this.#createAgentRuntime = options.createAgentRuntime
      ?? (() => createDefaultAgentRuntime(this.#workspacePath, this.#threadStore));
    this.#onChange = typeof options.onChange === "function" ? options.onChange : null;
  }

  async getWorkspace() {
    const config = await readConfig(this.#workspacePath);
    return {
      name: config.name,
      path: this.#workspacePath,
    };
  }

  async listThreads(userId) {
    const appPath = this.#getUserAppPath(userId);
    const entries = await readDirectoryEntriesOrEmpty(appPath);
    const threads = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !THREAD_ID_PATTERN.test(entry.name)) {
        continue;
      }
      try {
        threads.push(await this.#readThreadSummary(userId, entry.name));
      } catch (error) {
        if (!error || error.code !== "ENOENT") {
          throw error;
        }
      }
    }
    return threads.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createThread(userId, input = {}) {
    const id = randomUUID();
    const threadDir = this.#getThreadDir(userId, id);
    const now = new Date().toISOString();
    const state = {
      id,
      title: normalizeTitle(input.title),
      createdAt: now,
      updatedAt: now,
    };
    await fs.mkdir(threadDir, { recursive: true });
    await writeJson(path.join(threadDir, "state.json"), state);
    const thread = { ...state, messageCount: 0, preview: "" };
    await this.#emitChange({ type: "thread.created", userId, threadId: id });
    return thread;
  }

  async getThread(userId, threadId) {
    const summary = await this.#readThreadSummary(userId, threadId);
    const events = await this.#threadStore.loadEvents(this.#getThreadDir(userId, threadId));
    return {
      ...summary,
      events,
      messages: events
        .filter((event) => event.type === "message")
        .map((event) => ({
          id: event.id,
          at: event.at,
          role: event.message.role,
          items: event.message.items,
          meta: event.message.meta,
          text: messageText(event.message),
        })),
    };
  }

  async sendMessage(userId, threadId, text) {
    const normalizedText = normalizeMessage(text);
    await this.#readThreadState(userId, threadId);
    const queueKey = `${safeUserId(userId)}:${threadId}`;
    return this.#enqueue(queueKey, async () => {
      const runtime = await this.#getAgentRuntime();
      const threadDir = this.#getThreadDir(userId, threadId);
      const result = await runtime.handleThreadMessage({
        threadId,
        threadDir,
        userId,
        text: normalizedText,
      });
      const state = await this.#readThreadState(userId, threadId);
      await writeJson(path.join(threadDir, "state.json"), {
        ...state,
        updatedAt: new Date().toISOString(),
      });
      await this.#emitChange({ type: "thread.changed", userId, threadId });
      return result;
    });
  }

  async stop() {
    if (!this.#agentRuntimePromise) {
      return;
    }
    const runtime = await this.#agentRuntimePromise;
    await runtime?.stop?.();
    this.#agentRuntimePromise = null;
  }

  async #readThreadSummary(userId, threadId) {
    const state = await this.#readThreadState(userId, threadId);
    const messages = await this.#threadStore.loadMessages(this.#getThreadDir(userId, threadId));
    const lastMessage = messages[messages.length - 1];
    return {
      id: threadId,
      title: state.title,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      messageCount: messages.length,
      preview: lastMessage?.text?.trim().slice(0, 120) ?? "",
    };
  }

  async #readThreadState(userId, threadId) {
    assertThreadId(threadId);
    try {
      return JSON.parse(
        await fs.readFile(path.join(this.#getThreadDir(userId, threadId), "state.json"), "utf8"),
      );
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw new Error(`Thread not found: ${threadId}`);
      }
      throw error;
    }
  }

  #getThreadDir(userId, threadId) {
    assertThreadId(threadId);
    return path.join(this.#getUserAppPath(userId), threadId);
  }

  #getUserAppPath(userId) {
    return path.join(
      this.#workspacePath,
      "users",
      safeUserId(userId),
      "channels",
      "app",
    );
  }

  #getAgentRuntime() {
    if (!this.#agentRuntimePromise) {
      this.#agentRuntimePromise = Promise.resolve(this.#createAgentRuntime());
    }
    return this.#agentRuntimePromise;
  }

  async #emitChange(change) {
    await this.#onChange?.(change);
  }

  async #enqueue(key, task) {
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    this.#queues.set(key, current);
    try {
      return await current;
    } finally {
      if (this.#queues.get(key) === current) {
        this.#queues.delete(key);
      }
    }
  }
}

async function createDefaultAgentRuntime(workspacePath, threadStore) {
  const provider = await loadWorkspaceLanguageProvider(workspacePath);
  const instructions = await loadChannelInstructions(workspacePath, "app");
  return new InProcessChatAgentRuntime({
    lang: provider.lang,
    defaultCwd: workspacePath,
    instructions,
    threadStore,
    loadInstructions: (input) =>
      loadChannelInstructions(workspacePath, "app", input.threadDir),
    loadTools: (input) => loadChannelTools(workspacePath, "app", input),
  });
}

function normalizeTitle(value) {
  const title = typeof value === "string" ? value.trim() : "";
  return (title || "New thread").slice(0, MAX_TITLE_LENGTH);
}

function normalizeMessage(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error("Message text is required.");
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message text cannot exceed ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters.`);
  }
  return text;
}

function assertThreadId(threadId) {
  if (typeof threadId !== "string" || !THREAD_ID_PATTERN.test(threadId)) {
    throw new Error("Invalid thread id.");
  }
}

function safeUserId(userId) {
  if (typeof userId !== "string" || !userId) {
    throw new Error("User id is required.");
  }
  return createHash("sha256").update(userId).digest("hex");
}

function messageText(message) {
  return message.items
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

async function readDirectoryEntriesOrEmpty(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
