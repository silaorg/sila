import fs from "node:fs/promises";
import path from "node:path";
import { buildManagedInstructionBlocks, defaultAgentInstructions } from "@sila/agents";

const DEFAULT_INSTRUCTIONS_DIR = path.join("agents", "default", "instructions");
const NULL_BYTE = "\u0000";

/**
 * @param {string} landPath
 * @param {string} channel
 * @returns {Promise<string>}
 */
export async function loadLandAgentInstructions(landPath, channel) {
  const normalizedChannel = normalizeChannel(channel);
  const defaults = defaultAgentInstructions({ channel: normalizedChannel });
  const customInstructionBlocks = await loadCustomInstructionBlocks(landPath);
  if (!customInstructionBlocks.length) {
    return defaults;
  }

  return [customInstructionBlocks.join("\n\n"), buildManagedInstructionBlocks(normalizedChannel).trim()].join("\n\n");
}

function normalizeChannel(channel) {
  return typeof channel === "string" ? channel.trim().toLowerCase() : "";
}

async function loadCustomInstructionBlocks(landPath) {
  const directoryPath = path.join(landPath, DEFAULT_INSTRUCTIONS_DIR);
  const filePaths = await listFilesRecursivelyOrNull(directoryPath);
  if (!filePaths || !filePaths.length) {
    return [];
  }

  const instructionBlocks = await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readTextFileOrNull(filePath);
      if (!content || !content.trim().length) {
        return null;
      }
      const relativePath = toPosixPath(path.relative(landPath, filePath));
      return `<instruction src="${relativePath}">${content}</instruction>`;
    }),
  );
  return instructionBlocks.filter(Boolean);
}

async function listFilesRecursivelyOrNull(directoryPath) {
  let entries;
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  const filePaths = [];
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const nestedPaths = await listFilesRecursivelyOrNull(entryPath);
      if (nestedPaths && nestedPaths.length) {
        filePaths.push(...nestedPaths);
      }
      continue;
    }
    if (entry.isFile()) {
      filePaths.push(entryPath);
    }
  }
  return filePaths;
}

async function readTextFileOrNull(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  if (content.includes(NULL_BYTE)) {
    return null;
  }
  return content;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}
