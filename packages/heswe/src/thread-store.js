import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { LangMessage } from "aiwrapper";

export const THREAD_MESSAGES_FILE_NAME = "messages.jsonl";
export const LEGACY_THREAD_MESSAGES_FILE_NAME = "messages.json";

export class ThreadStore {
  async loadMessages(threadDir) {
    const events = await this.loadEvents(threadDir);
    return events
      .filter((event) => event.type === "message")
      .map((event) => deserializeThreadMessage(event.message));
  }

  async loadEvents(threadDir) {
    const primaryPath = path.join(threadDir, THREAD_MESSAGES_FILE_NAME);
    const primaryRaw = await readFileOrNull(primaryPath);
    if (typeof primaryRaw === "string") {
      return parseThreadEvents(primaryRaw, primaryPath, THREAD_MESSAGES_FILE_NAME);
    }

    const legacyPath = path.join(threadDir, LEGACY_THREAD_MESSAGES_FILE_NAME);
    const legacyRaw = await readFileOrNull(legacyPath);
    if (typeof legacyRaw !== "string") {
      return [];
    }

    const messages = parseLegacyThreadMessages(
      legacyRaw,
      legacyPath,
      LEGACY_THREAD_MESSAGES_FILE_NAME,
    );
    const events = messages.map(createMessageEvent);
    await migrateLegacyEvents(primaryPath, events);
    return events;
  }

  async appendMessages(threadDir, messages) {
    const events = Array.from(messages, createMessageEvent);
    await appendEvents(threadDir, events);
    return events;
  }

  async appendEvent(threadDir, event) {
    const normalized = createEvent(event);
    await appendEvents(threadDir, [normalized]);
    return normalized;
  }
}

async function appendEvents(threadDir, events) {
  if (!events.length) {
    return;
  }

  await fs.mkdir(threadDir, { recursive: true });
  const filePath = path.join(threadDir, THREAD_MESSAGES_FILE_NAME);
  const payload = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  await fs.appendFile(filePath, payload, "utf8");
}

async function migrateLegacyEvents(primaryPath, events) {
  const payload = events.length
    ? `${events.map((event) => JSON.stringify(event)).join("\n")}\n`
    : "";
  try {
    await fs.writeFile(primaryPath, payload, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (!error || error.code !== "EEXIST") {
      throw error;
    }
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

function parseThreadEvents(raw, filePath, fileName) {
  const trimmed = raw.trim();
  if (!trimmed.length) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    return parseLegacyThreadMessages(raw, filePath, fileName).map(createLegacyMessageEvent);
  }

  try {
    return trimmed
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => normalizeStoredRecord(JSON.parse(line)));
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
    return parsed.map((item) => {
      deserializeThreadMessage(item);
      return serializeThreadMessage(item);
    });
  } catch (error) {
    throw invalidHistoryError(fileName, filePath, error);
  }
}

function normalizeStoredRecord(record) {
  if (record?.type === "message") {
    deserializeThreadMessage(record.message);
    return record;
  }

  if (record && typeof record === "object" && typeof record.type === "string") {
    return record;
  }

  deserializeThreadMessage(record);
  return createLegacyMessageEvent(record);
}

function createMessageEvent(message) {
  return createEvent({
    type: "message",
    message: serializeThreadMessage(message),
  });
}

function createLegacyMessageEvent(message) {
  return {
    type: "message",
    id: null,
    at: null,
    message: serializeThreadMessage(message),
  };
}

function createEvent(event) {
  if (!event || typeof event !== "object" || typeof event.type !== "string" || !event.type) {
    throw new Error("thread event must contain a non-empty type");
  }
  return {
    ...event,
    id: typeof event.id === "string" && event.id ? event.id : randomUUID(),
    at: typeof event.at === "string" && event.at ? event.at : new Date().toISOString(),
  };
}

function deserializeThreadMessage(item) {
  if (!item || typeof item !== "object" || typeof item.role !== "string" || !Array.isArray(item.items)) {
    throw new Error("message must contain a string role and an items array");
  }
  return new LangMessage(item.role, item.items, item.meta);
}

function serializeThreadMessage(message) {
  const serialized = {
    role: message.role,
    items: message.items,
  };
  if (message.meta !== undefined) {
    serialized.meta = message.meta;
  }
  return serialized;
}

function invalidHistoryError(fileName, filePath, error) {
  return new Error(`Invalid ${fileName} at ${filePath}: ${error.message}`, { cause: error });
}
