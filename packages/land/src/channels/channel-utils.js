import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const OptionalTokenSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  });

export function sanitizeThreadId(input) {
  return String(input).replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Serializes async tasks per key while allowing keys to run independently.
 * @param {Map<string, Promise<void>>} queueByKey
 * @param {string} key
 * @param {() => Promise<void>} task
 */
export async function enqueueSerialTask(queueByKey, key, task) {
  const previous = queueByKey.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  queueByKey.set(key, current);
  try {
    await current;
  } finally {
    if (queueByKey.get(key) === current) {
      queueByKey.delete(key);
    }
  }
}

export async function saveThreadState(threadDir, state) {
  const filePath = path.join(threadDir, "state.json");
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function readOpenAiApiKey(channelPath) {
  const providerPath = path.resolve(channelPath, "..", "..", "providers", "openai.json");
  const fromConfig = await readProviderApiKey(providerPath);
  if (fromConfig) {
    return fromConfig;
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }
  return null;
}

async function readProviderApiKey(providerPath) {
  let raw;
  try {
    raw = await fs.readFile(providerPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(`Invalid OpenAI provider config at ${providerPath}:`, error.message);
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const value = parsed.apiKey;
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
