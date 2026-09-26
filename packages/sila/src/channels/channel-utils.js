import path from "node:path";
import { z } from "zod";
import { loadWorkspaceAgentInstructions } from "../agent-instructions.js";
import {
  readWorkspaceEnvironment,
  readWorkspaceEnvValue,
} from "../env.js";
import { loadWorkspaceLanguageProvider } from "../providers.js";
import {
  buildRuntimePathEnvironment,
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
  return readWorkspaceEnvValue(workspacePath, "OPENAI_API_KEY");
}

export async function loadChannelLanguageProvider(channelPath) {
  const workspacePath = path.resolve(channelPath, "..", "..");
  return loadWorkspaceLanguageProvider(workspacePath);
}

export async function loadChannelInstructions(workspacePath, channel, threadPath) {
  const baseInstructions = await loadWorkspaceAgentInstructions(workspacePath, channel);
  const runtimePaths = await resolveRuntimePaths({ workspacePath, threadPath });
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
  const environment = await buildChannelEnvironment(workspacePath, runtimePaths);
  return loadWorkspaceTools(workspacePath, {
    channel,
    threadDir: input.threadDir,
    threadId: input.threadId,
    sourcePath: runtimePaths.sourcePath,
    environment,
    defaultCwd: input.threadDir ?? workspacePath,
  });
}

export async function loadChannelEnvironment(workspacePath, threadPath) {
  const runtimePaths = await resolveRuntimePaths({ workspacePath, threadPath });
  return buildChannelEnvironment(workspacePath, runtimePaths);
}

async function buildChannelEnvironment(workspacePath, runtimePaths) {
  const workspaceEnvironment = await readWorkspaceEnvironment(workspacePath);
  const inheritedNames = new Set(Object.keys(process.env));
  const localEnvironment = Object.fromEntries(
    Object.entries(workspaceEnvironment)
      .filter(([name]) => !inheritedNames.has(name)),
  );
  return {
    ...localEnvironment,
    ...buildRuntimePathEnvironment(runtimePaths),
  };
}
