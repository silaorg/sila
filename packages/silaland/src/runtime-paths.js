import fs from "node:fs/promises";
import path from "node:path";
import { readEnvValue } from "./env.js";

const SOURCE_PATH_ENV_NAMES = ["SOURCE_PATH", "REPO_ROOT"];

/**
 * @param {{ landPath: string; threadPath?: string }} input
 * @returns {Promise<{ landPath: string; threadPath: string | null; sourcePath: string | null }>}
 */
export async function resolveRuntimePaths(input) {
  const landPath = await toAbsolutePath(input.landPath);
  const threadPath = typeof input.threadPath === "string" ? await toAbsolutePath(input.threadPath) : null;
  const sourcePath = await resolveSourcePath(landPath);

  return {
    landPath,
    threadPath,
    sourcePath,
  };
}

/**
 * @param {{ landPath: string; threadPath: string | null; sourcePath: string | null }} runtimePaths
 * @returns {string}
 */
export function buildRuntimePathsInstructionBlock(runtimePaths) {
  const threadPath = runtimePaths.threadPath ?? "[not set]";
  const sourcePath = runtimePaths.sourcePath ?? "[not set]";

  return `
<environment_runtime_paths>
Land root (absolute): ${runtimePaths.landPath}
Current thread root (absolute): ${threadPath}
Source repo root (absolute): ${sourcePath}
Use source repo root for source code changes.
Use current thread root for thread files.
Use land root for channels and assets.
</environment_runtime_paths>
`.trim();
}

/**
 * @param {{ landPath: string; threadPath: string | null; sourcePath: string | null }} runtimePaths
 * @returns {void}
 */
export function applyRuntimePathEnvironment(runtimePaths) {
  process.env.LAND_PATH = runtimePaths.landPath;

  if (runtimePaths.threadPath) {
    process.env.THREAD_PATH = runtimePaths.threadPath;
  } else {
    delete process.env.THREAD_PATH;
  }

  if (runtimePaths.sourcePath) {
    process.env.SOURCE_PATH = runtimePaths.sourcePath;
  } else {
    delete process.env.SOURCE_PATH;
  }
}

async function resolveSourcePath(landPath) {
  const configured = readConfiguredSourcePath();
  if (configured) {
    return toAbsolutePath(configured);
  }
  return findGitRootOrNull(landPath);
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
