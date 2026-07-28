import path from "node:path";
import { InProcessChatAgentRuntime } from "../agent-runtime/chat-agent-runtime.js";
import { ThreadStore } from "../agent-runtime/thread-store.js";
import {
  loadChannelInstructions,
  loadChannelTools,
} from "../channels/channel-utils.js";
import { readConfig } from "../config.js";
import { loadWorkspaceLanguageProvider } from "../providers.js";
import { enqueueSerialTask } from "../serial-task-queue.js";
import { getPublicMessageText } from "./app-message.js";
import { AppThreadRepository } from "./app-thread-repository.js";
import { AppWorkspaceError } from "./app-workspace-error.js";

const MAX_MESSAGE_LENGTH = 50_000;
const MAX_TITLE_LENGTH = 100;

export class AppWorkspaceService {
  #workspacePath;
  #threads;
  #createAgentRuntime;
  #agentRuntimePromise = null;
  #onChange;
  #queues = new Map();

  constructor(options) {
    if (!options?.workspacePath) {
      throw new AppWorkspaceError(
        "invalid_input",
        "AppWorkspaceService requires workspacePath.",
      );
    }
    this.#workspacePath = path.resolve(options.workspacePath);
    const threadStore = options.threadStore instanceof ThreadStore
      ? options.threadStore
      : new ThreadStore();
    this.#threads = new AppThreadRepository(this.#workspacePath, threadStore);
    this.#createAgentRuntime = options.createAgentRuntime
      ?? (() => createDefaultAgentRuntime(this.#workspacePath, threadStore));
    this.#onChange = typeof options.onChange === "function" ? options.onChange : null;
  }

  async getWorkspace() {
    const config = await readConfig(this.#workspacePath);
    return { name: config.name };
  }

  listThreads(userId) {
    return this.#threads.list(userId);
  }

  async createThread(userId, input = {}) {
    const thread = await this.#threads.create(userId, normalizeTitle(input?.title));
    await this.#emitChange({ type: "thread.created", userId, threadId: thread.id });
    return thread;
  }

  async getThread(userId, threadId) {
    const { summary, events } = await this.#threads.get(userId, threadId);
    return {
      ...summary,
      messages: events
        .filter((event) => event.type === "message")
        .map(projectMessage),
    };
  }

  async sendMessage(userId, threadId, text) {
    const normalizedText = normalizeMessage(text);
    await this.#threads.require(userId, threadId);
    const queueKey = JSON.stringify([userId, threadId]);
    return enqueueSerialTask(this.#queues, queueKey, async () => {
      const runtime = await this.#getAgentRuntime();
      const threadDir = this.#threads.getThreadDir(userId, threadId);
      let result;
      let runtimeFailed = false;
      let runtimeError;

      try {
        result = await runtime.handleThreadMessage({
          threadId,
          threadDir,
          userId,
          text: normalizedText,
        });
      } catch (error) {
        runtimeFailed = true;
        runtimeError = error;
      }

      try {
        await this.#threads.touch(userId, threadId);
        await this.#emitChange({ type: "thread.changed", userId, threadId });
      } catch (error) {
        if (!runtimeFailed) {
          throw error;
        }
        console.error(`Failed to update app thread ${threadId} after agent failure:`, error);
      }

      if (runtimeFailed) {
        throw runtimeError;
      }
      return result;
    });
  }

  async stop() {
    await Promise.allSettled(this.#queues.values());
    if (!this.#agentRuntimePromise) {
      return;
    }
    const runtime = await this.#agentRuntimePromise;
    this.#agentRuntimePromise = null;
    await runtime?.stop?.();
  }

  #getAgentRuntime() {
    if (!this.#agentRuntimePromise) {
      const pending = Promise.resolve().then(() => this.#createAgentRuntime());
      this.#agentRuntimePromise = pending;
      void pending.catch(() => {
        if (this.#agentRuntimePromise === pending) {
          this.#agentRuntimePromise = null;
        }
      });
    }
    return this.#agentRuntimePromise;
  }

  async #emitChange(change) {
    try {
      await this.#onChange?.(change);
    } catch (error) {
      console.error(`Failed to publish ${change.type}:`, error);
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
    alwaysRespond: true,
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
    throw new AppWorkspaceError("invalid_input", "Message text is required.");
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new AppWorkspaceError(
      "invalid_input",
      `Message text cannot exceed ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters.`,
    );
  }
  return text;
}

function projectMessage(event) {
  return {
    id: event.id,
    at: event.at,
    role: event.message.role,
    text: getPublicMessageText(event.message),
  };
}
