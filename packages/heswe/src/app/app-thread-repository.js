import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ThreadStore } from "../thread-store.js";
import { writeJsonFile } from "../json-file.js";
import { getPublicMessageText } from "./app-message.js";
import { AppWorkspaceError } from "./app-workspace-error.js";

const THREAD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export class AppThreadRepository {
  #workspacePath;
  #threadStore;

  constructor(workspacePath, threadStore = new ThreadStore()) {
    this.#workspacePath = path.resolve(workspacePath);
    this.#threadStore = threadStore;
  }

  async list(userId) {
    const entries = await readDirectoryEntriesOrEmpty(this.#getUserAppPath(userId));
    const threads = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !THREAD_ID_PATTERN.test(entry.name)) {
        continue;
      }
      try {
        threads.push(await this.#readSummary(userId, entry.name));
      } catch (error) {
        if (!(error instanceof AppWorkspaceError) || error.code !== "not_found") {
          throw error;
        }
      }
    }
    return threads.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async create(userId, title) {
    const id = randomUUID();
    const threadDir = this.getThreadDir(userId, id);
    const now = new Date().toISOString();
    const state = { id, title, createdAt: now, updatedAt: now };
    await fs.mkdir(path.dirname(threadDir), { recursive: true });
    await fs.mkdir(threadDir);
    try {
      await writeJsonFile(path.join(threadDir, "state.json"), state);
    } catch (error) {
      await fs.rm(threadDir, { recursive: true, force: true });
      throw error;
    }
    return { ...state, messageCount: 0, preview: "" };
  }

  async get(userId, threadId) {
    const summary = await this.#readSummary(userId, threadId);
    const events = await this.#threadStore.loadEvents(this.getThreadDir(userId, threadId));
    return { summary, events };
  }

  async require(userId, threadId) {
    await this.#readState(userId, threadId);
    return this.getThreadDir(userId, threadId);
  }

  async touch(userId, threadId) {
    const state = await this.#readState(userId, threadId);
    await writeJsonFile(
      path.join(this.getThreadDir(userId, threadId), "state.json"),
      { ...state, updatedAt: new Date().toISOString() },
    );
  }

  getThreadDir(userId, threadId) {
    assertThreadId(threadId);
    return path.join(this.#getUserAppPath(userId), threadId);
  }

  async #readSummary(userId, threadId) {
    const state = await this.#readState(userId, threadId);
    const messages = await this.#threadStore.loadMessages(this.getThreadDir(userId, threadId));
    const lastMessage = messages[messages.length - 1];
    return {
      id: threadId,
      title: state.title,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      messageCount: messages.length,
      preview: lastMessage
        ? getPublicMessageText(lastMessage).trim().slice(0, 120)
        : "",
    };
  }

  async #readState(userId, threadId) {
    const filePath = path.join(this.getThreadDir(userId, threadId), "state.json");
    let raw;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new AppWorkspaceError("not_found", `Thread not found: ${threadId}`, {
          cause: error,
        });
      }
      throw error;
    }

    try {
      return validateThreadState(JSON.parse(raw), threadId);
    } catch (error) {
      if (error instanceof AppWorkspaceError) {
        throw error;
      }
      throw new AppWorkspaceError(
        "invalid_data",
        `Invalid thread state at ${filePath}: ${error.message}`,
        { cause: error },
      );
    }
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
}

function assertThreadId(threadId) {
  if (typeof threadId !== "string" || !THREAD_ID_PATTERN.test(threadId)) {
    throw new AppWorkspaceError("invalid_input", "Invalid thread id.");
  }
}

function safeUserId(userId) {
  if (typeof userId !== "string" || !userId) {
    throw new AppWorkspaceError("invalid_input", "User id is required.");
  }
  return createHash("sha256").update(userId).digest("hex");
}

function validateThreadState(state, threadId) {
  const valid = state
    && typeof state === "object"
    && state.id === threadId
    && typeof state.title === "string"
    && typeof state.createdAt === "string"
    && typeof state.updatedAt === "string";
  if (!valid) {
    throw new AppWorkspaceError(
      "invalid_data",
      `Invalid state for thread ${threadId}.`,
    );
  }
  return state;
}

async function readDirectoryEntriesOrEmpty(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
