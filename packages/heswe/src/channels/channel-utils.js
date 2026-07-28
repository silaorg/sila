import path from "node:path";
import { z } from "zod";
import { loadWorkspaceAgentInstructions } from "../agent-instructions.js";
import { loadWorkspaceEnvironment, readEnvValue } from "../env.js";
import { loadWorkspaceLanguageProvider } from "../providers.js";
import {
  applyRuntimePathEnvironment,
  buildRuntimePathsInstructionBlock,
  resolveRuntimePaths,
} from "../runtime-paths.js";
import { appendSkillCatalogInstructions, loadSkillIndex } from "../skills.js";
import { loadWorkspaceTools } from "../tools.js";
import { writeJsonFile } from "../json-file.js";

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

export async function saveThreadState(threadDir, state) {
  const filePath = path.join(threadDir, "state.json");
  await writeJsonFile(filePath, state);
}

export async function readOpenAiApiKey(channelPath) {
  const workspacePath = path.resolve(channelPath, "..", "..");
  await loadWorkspaceEnvironment(workspacePath);
  return readEnvValue("OPENAI_API_KEY");
}

export async function loadChannelLanguageProvider(channelPath) {
  const workspacePath = path.resolve(channelPath, "..", "..");
  return loadWorkspaceLanguageProvider(workspacePath);
}

export async function loadChannelInstructions(workspacePath, channel, threadPath) {
  const baseInstructions = await loadWorkspaceAgentInstructions(workspacePath, channel);
  const runtimePaths = await resolveRuntimePaths({ workspacePath, threadPath });
  applyRuntimePathEnvironment(runtimePaths);
  const skills = await loadSkillIndex(workspacePath);
  const runtimePathBlock = buildRuntimePathsInstructionBlock(runtimePaths);
  return appendSkillCatalogInstructions([baseInstructions, runtimePathBlock].join("\n\n"), skills);
}

export function formatWorkingMessage(text) {
  const body = String(text || "").trim();
  return body ? `🔄 Working...\n\n${body}` : "🔄 Working...";
}

export function toAgentRelativePath(absolutePath, baseDir) {
  return path.relative(baseDir, absolutePath).split(path.sep).join("/");
}

export async function loadChannelTools(workspacePath, channel, input = {}) {
  const runtimePaths = await resolveRuntimePaths({ workspacePath, threadPath: input.threadDir });
  applyRuntimePathEnvironment(runtimePaths);
  return loadWorkspaceTools(workspacePath, {
    channel,
    threadDir: input.threadDir,
    threadId: input.threadId,
    sourcePath: runtimePaths.sourcePath,
    defaultCwd: input.threadDir ?? workspacePath,
  });
}
