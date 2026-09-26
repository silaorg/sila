import fs from "node:fs/promises";
import path from "node:path";
import { readEnvValue } from "./env.js";

const SOURCE_PATH_ENV_NAMES = ["SOURCE_PATH", "REPO_ROOT"];

/**
 * @param {{ workspacePath: string; threadPath?: string }} input
 * @returns {Promise<{ workspacePath: string; threadPath: string | null; sourcePath: string | null }>}
 */
export async function resolveRuntimePaths(input) {
  const workspacePath = await toAbsolutePath(input.workspacePath);
  const threadPath = typeof input.threadPath === "string" ? await toAbsolutePath(input.threadPath) : null;
  const sourcePath = await resolveSourcePath(workspacePath);

  return {
    workspacePath,
    threadPath,
    sourcePath,
  };
}

/**
 * @param {{ workspacePath: string; threadPath: string | null; sourcePath: string | null }} runtimePaths
 * @returns {string}
 */
export function buildRuntimePathsInstructionBlock(runtimePaths) {
  const threadPath = runtimePaths.threadPath ?? "[not set]";
  const sourcePath = runtimePaths.sourcePath ?? "[not set]";

  return `
<environment_runtime_paths>
Workspace root (absolute): ${runtimePaths.workspacePath}
Current thread root (absolute): ${threadPath}
Source repo root (absolute): ${sourcePath}
Use source repo root for source code changes.
Use current thread root for thread files.
Use workspace root for channels and assets.
</environment_runtime_paths>
`.trim();
}

/**
 * @param {{ workspacePath: string; threadPath: string | null; sourcePath: string | null }} runtimePaths
 * @returns {Record<string, string>}
 */
export function buildRuntimePathEnvironment(runtimePaths) {
  const environment = {
    WORKSPACE_PATH: runtimePaths.workspacePath,
  };
  if (runtimePaths.threadPath) {
    environment.THREAD_PATH = runtimePaths.threadPath;
  }
  if (runtimePaths.sourcePath) {
    environment.SOURCE_PATH = runtimePaths.sourcePath;
  }
  return environment;
}

/**
 * @param {Record<string, string | undefined>} baseEnvironment
 * @param {Record<string, string>} runtimeEnvironment
 * @returns {Record<string, string | undefined>}
 */
export function mergeRuntimePathEnvironment(baseEnvironment, runtimeEnvironment) {
  const environment = { ...baseEnvironment };
  delete environment.WORKSPACE_PATH;
  delete environment.THREAD_PATH;
  delete environment.SOURCE_PATH;
  return { ...environment, ...runtimeEnvironment };
}

async function resolveSourcePath(workspacePath) {
  const configured = readConfiguredSourcePath();
  if (configured) {
    return toAbsolutePath(configured);
  }
  return findGitRootOrNull(workspacePath);
}

function readConfiguredSourcePath() {
  for (const envName of SOURCE_PATH_ENV_NAMES) {
    const value = readEnvValue(envName);
    if (value) {
      return value;
    }
  }
  return null;
}

async function findGitRootOrNull(startPath) {
  let currentPath = await toAbsolutePath(startPath);

  while (true) {
    const gitPath = path.join(currentPath, ".git");
    if (await pathExists(gitPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }
    currentPath = parentPath;
  }
}

async function toAbsolutePath(value) {
  const absolutePath = path.resolve(value);
  try {
    return await fs.realpath(absolutePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return absolutePath;
    }
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
