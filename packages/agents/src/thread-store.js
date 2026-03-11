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
  } catch {
    console.error(`Invalid ${fileName} at ${filePath}, starting with empty history.`);
    return [];
  }
}

function parseLegacyThreadMessages(raw, filePath, fileName) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`Invalid ${fileName} at ${filePath}, starting with empty history.`);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error(`Invalid ${fileName} format at ${filePath}, expected array.`);
    return [];
  }

  return parsed.map(deserializeThreadMessage);
}

function deserializeThreadMessage(item) {
  return new LangMessage(item.role, item.items, item.meta);
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
