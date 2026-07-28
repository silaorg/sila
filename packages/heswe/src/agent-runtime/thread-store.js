import fs from "node:fs/promises";
import path from "node:path";
import { LangMessage } from "aiwrapper";

export const THREAD_MESSAGES_FILE_NAME = "messages.jsonl";
export const LEGACY_THREAD_MESSAGES_FILE_NAME = "messages.json";

export class ThreadStore {
  async loadMessages(threadDir) {
    const primaryPath = path.join(threadDir, THREAD_MESSAGES_FILE_NAME);
    const primaryRaw = await readFileOrNull(primaryPath);
    if (typeof primaryRaw === "string") {
      return parseThreadMessages(primaryRaw, primaryPath, THREAD_MESSAGES_FILE_NAME);
    }

    const legacyPath = path.join(threadDir, LEGACY_THREAD_MESSAGES_FILE_NAME);
    const legacyRaw = await readFileOrNull(legacyPath);
    if (typeof legacyRaw === "string") {
      const messages = parseThreadMessages(legacyRaw, legacyPath, LEGACY_THREAD_MESSAGES_FILE_NAME);
      await this.migrateLegacyMessages(threadDir, messages);
      return messages;
    }

    return [];
  }

  async saveMessages(threadDir, messages) {
    const filePath = path.join(threadDir, THREAD_MESSAGES_FILE_NAME);
    const serialized = serializeThreadMessages(messages);
    await fs.writeFile(filePath, serialized ? `${serialized}\n` : "", "utf8");
  }

  // Temporary migration logic. Remove this once all active threads have been
  // rewritten from messages.json to messages.jsonl.
  async migrateLegacyMessages(threadDir, messages) {
    await this.saveMessages(threadDir, messages);
  }
}

async function readFileOrNull(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseThreadMessages(raw, filePath, fileName) {
  const trimmed = raw.trim();
  if (!trimmed.length) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    return parseLegacyThreadMessages(raw, filePath, fileName);
  }

  try {
    return trimmed
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line))
      .map(deserializeThreadMessage);
  } catch (error) {
    throw invalidHistoryError(fileName, filePath, error);
  }
}

function parseLegacyThreadMessages(raw, filePath, fileName) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw invalidHistoryError(fileName, filePath, error);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid ${fileName} at ${filePath}: expected an array.`);
  }

  try {
    return parsed.map(deserializeThreadMessage);
  } catch (error) {
    throw invalidHistoryError(fileName, filePath, error);
  }
}

function deserializeThreadMessage(item) {
  if (!item || typeof item !== "object" || typeof item.role !== "string" || !Array.isArray(item.items)) {
    throw new Error("message must contain a string role and an items array");
  }
  return new LangMessage(item.role, item.items, item.meta);
}

function invalidHistoryError(fileName, filePath, error) {
  return new Error(`Invalid ${fileName} at ${filePath}: ${error.message}`, { cause: error });
}

function serializeThreadMessages(messages) {
  return Array.from(messages)
    .map((message) =>
      JSON.stringify({
        role: message.role,
        items: message.items,
        meta: message.meta,
      }),
    )
    .join("\n");
}
