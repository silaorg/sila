import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadLandAgentInstructions } from "../agent-instructions.js";
import { loadLandEnvironment, readEnvValue } from "../env.js";
import {
  applyRuntimePathEnvironment,
  buildRuntimePathsInstructionBlock,
  resolveRuntimePaths,
} from "../runtime-paths.js";
import { appendSkillCatalogInstructions, loadSkillIndex } from "../skills.js";
import { loadLandTools } from "../tools.js";

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
  const landPath = path.resolve(channelPath, "..", "..");
  await loadLandEnvironment(landPath);
  return readEnvValue("OPENAI_API_KEY");
}

export async function readExaApiKey(channelPath) {
  const landPath = path.resolve(channelPath, "..", "..");
  await loadLandEnvironment(landPath);
  return readEnvValue("EXA_API_KEY");
}

export async function loadChannelInstructions(landPath, channel, threadPath) {
  const baseInstructions = await loadLandAgentInstructions(landPath, channel);
  const runtimePaths = await resolveRuntimePaths({ landPath, threadPath });
  applyRuntimePathEnvironment(runtimePaths);
  const skills = await loadSkillIndex(landPath, { sourcePath: runtimePaths.sourcePath ?? undefined });
  const runtimePathBlock = buildRuntimePathsInstructionBlock(runtimePaths);
  return appendSkillCatalogInstructions([baseInstructions, runtimePathBlock].join("\n\n"), skills);
}

export async function loadChannelTools(landPath, channel, input = {}) {
  const runtimePaths = await resolveRuntimePaths({ landPath, threadPath: input.threadDir });
  applyRuntimePathEnvironment(runtimePaths);
  return loadLandTools(landPath, {
    channel,
    threadDir: input.threadDir,
    threadId: input.threadId,
    sourcePath: runtimePaths.sourcePath,
    defaultCwd: input.threadDir ?? landPath,
  });
}
