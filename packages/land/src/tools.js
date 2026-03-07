import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createChatAgent } from "@sila/agents";

const TOOLS_DIR_NAME = "tools";
const PACKAGE_FILE_NAME = "package.json";
const BUILT_IN_TOOL_NAMES = getBuiltInToolNames();

/**
 * @param {string} landPath
 * @param {{
 *   threadDir?: string;
 *   threadId?: string;
 *   channel?: string;
 *   sourcePath?: string | null;
 *   defaultCwd?: string;
 *   logger?: Pick<Console, "warn">;
 * }} [options]
 * @returns {Promise<Array<{name: string; description: string; parameters: Record<string, unknown>; handler: Function}>>}
 */
export async function loadLandTools(landPath, options = {}) {
  const logger = options.logger ?? console;
  const toolsDirPath = path.join(landPath, TOOLS_DIR_NAME);
  const entries = await readDirectoryEntriesOrEmpty(toolsDirPath);
  const sortedEntries = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  const seenToolNames = new Set();
  const tools = [];

  for (const entry of sortedEntries) {
    const packageDirPath = path.join(toolsDirPath, entry.name);
    const packageFilePath = path.join(packageDirPath, PACKAGE_FILE_NAME);

    try {
      const tool = await loadToolPackage(packageDirPath, packageFilePath, {
        landPath,
        threadDir: options.threadDir,
        threadId: options.threadId,
        channel: options.channel,
        sourcePath: options.sourcePath ?? null,
        defaultCwd: options.defaultCwd ?? options.threadDir ?? landPath,
        logger,
      });

      if (BUILT_IN_TOOL_NAMES.has(tool.name)) {
        logger.warn(`Skipping tool package at ${packageDirPath}: tool name "${tool.name}" collides with a built-in tool.`);
        continue;
      }

      if (seenToolNames.has(tool.name)) {
        logger.warn(`Skipping tool package at ${packageDirPath}: duplicate tool name "${tool.name}".`);
        continue;
      }

      seenToolNames.add(tool.name);
      tools.push(tool);
    } catch (error) {
      logger.warn(`Skipping tool package at ${packageDirPath}: ${error.message}`);
    }
  }

  return tools;
}

/**
 * @param {string} packageDirPath
 * @param {string} packageFilePath
 * @param {{
 *   landPath: string;
 *   threadDir?: string;
 *   threadId?: string;
 *   channel?: string;
 *   sourcePath: string | null;
 *   defaultCwd: string;
 *   logger: Pick<Console, "warn">;
 * }} context
 */
async function loadToolPackage(packageDirPath, packageFilePath, context) {
  const packageJson = await readJsonFile(packageFilePath);
  const entryRelativePath = resolveEntryRelativePath(packageJson);
  const entryFilePath = path.resolve(packageDirPath, entryRelativePath);
  const entryStat = await fs.stat(entryFilePath);
  if (!entryStat.isFile()) {
    throw new Error(`entry is not a file: ${entryFilePath}`);
  }

  const packageStat = await fs.stat(packageFilePath);
  const moduleUrl = createVersionedModuleUrl(entryFilePath, packageStat.mtimeMs, entryStat.mtimeMs);
  const imported = await import(moduleUrl);
  const toolFactory = resolveToolFactory(imported);
  const tool = typeof toolFactory === "function"
    ? await toolFactory({
      landPath: context.landPath,
      threadDir: context.threadDir ?? context.defaultCwd,
      threadId: context.threadId ?? "",
      channel: context.channel ?? "",
      sourcePath: context.sourcePath,
      defaultCwd: context.defaultCwd,
      logger: context.logger,
    })
    : toolFactory;

  validateToolShape(tool, packageDirPath);
  return tool;
}

function resolveEntryRelativePath(packageJson) {
  if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
    throw new Error("invalid package.json content");
  }

  const entry = typeof packageJson.main === "string" && packageJson.main.trim().length
    ? packageJson.main.trim()
    : "index.js";

  if (path.isAbsolute(entry)) {
    throw new Error("package.json main must be a relative path");
  }

  return entry;
}

function resolveToolFactory(imported) {
  if (imported && typeof imported.createTool === "function") {
    return imported.createTool;
  }
  if (imported && typeof imported.default === "function") {
    return imported.default;
  }
  if (imported && imported.default && typeof imported.default === "object") {
    return imported.default;
  }
  throw new Error("tool package must export createTool(context), a default factory, or a default tool object");
}

function validateToolShape(tool, packageDirPath) {
  if (!tool || typeof tool !== "object") {
    throw new Error("tool factory must return an object");
  }
  if (typeof tool.name !== "string" || !tool.name.trim().length) {
    throw new Error("tool must define a non-empty name");
  }
  if (typeof tool.description !== "string" || !tool.description.trim().length) {
    throw new Error("tool must define a non-empty description");
  }
  if (!tool.parameters || typeof tool.parameters !== "object" || Array.isArray(tool.parameters)) {
    throw new Error("tool must define a parameters object");
  }
  if (typeof tool.handler !== "function") {
    throw new Error("tool must define a handler function");
  }

  if (path.basename(packageDirPath) !== path.basename(packageDirPath).trim()) {
    throw new Error("tool package directory name must not have leading or trailing whitespace");
  }
}

async function readDirectoryEntriesOrEmpty(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readJsonFile(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`missing ${PACKAGE_FILE_NAME}`);
    }
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid ${PACKAGE_FILE_NAME}: ${error.message}`);
  }
}

function createVersionedModuleUrl(entryFilePath, packageMtimeMs, entryMtimeMs) {
  const url = pathToFileURL(entryFilePath);
  url.searchParams.set("v", `${Math.trunc(packageMtimeMs)}-${Math.trunc(entryMtimeMs)}`);
  return url.href;
}

function getBuiltInToolNames() {
  const agent = createChatAgent(null, {
    threadId: "tool-name-probe",
    ptyManager: createPtyStub(),
    defaultCwd: process.cwd(),
  });

  return new Set((agent.messages.availableTools || []).map((tool) => tool.name).filter(Boolean));
}

function createPtyStub() {
  return {
    hasSession() {
      return false;
    },
    startSession() {
      return { status: "started", cwd: process.cwd(), shell: "bash" };
    },
    stopSession() {
      return { status: "stopped" };
    },
    resetSession() {
      return { status: "reset", cwd: process.cwd(), shell: "bash" };
    },
    getStatus() {
      return { running: false };
    },
    async execute() {
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
        cwd: process.cwd(),
        truncated: false,
        timedOut: false,
      };
    },
  };
}
