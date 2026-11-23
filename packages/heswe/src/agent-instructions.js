import fs from "node:fs/promises";
import path from "node:path";
import { buildManagedInstructionBlocks, defaultAgentInstructions } from "./agent-runtime/index.js";
import { readDirectoryEntriesOrEmpty } from "./directory-entries.js";

const DEFAULT_INSTRUCTIONS_DIR = path.join("agents", "default", "instructions");
const NULL_BYTE = "\u0000";

/**
 * @param {string} workspacePath
 * @param {string} channel
 * @returns {Promise<string>}
 */
export async function loadWorkspaceAgentInstructions(workspacePath, channel) {
  const normalizedChannel = normalizeChannel(channel);
  const customInstructionBlocks = await loadCustomInstructionBlocks(workspacePath);
  if (!customInstructionBlocks.length) {
    return defaultAgentInstructions({ channel: normalizedChannel });
  }

  return [customInstructionBlocks.join("\n\n"), buildManagedInstructionBlocks(normalizedChannel).trim()].join("\n\n");
}

function normalizeChannel(channel) {
  return typeof channel === "string" ? channel.trim().toLowerCase() : "";
}

async function loadCustomInstructionBlocks(workspacePath) {
  const directoryPath = path.join(workspacePath, DEFAULT_INSTRUCTIONS_DIR);
  const filePaths = await listInstructionFiles(directoryPath);
  const instructionBlocks = await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readTextFileOrNull(filePath);
      if (!content || !content.trim().length) {
        return null;
      }
      const relativePath = toPosixPath(path.relative(workspacePath, filePath));
      return `<instruction src="${relativePath}">${content}</instruction>`;
    }),
  );
  return instructionBlocks.filter(Boolean);
}

async function listInstructionFiles(directoryPath) {
  const entries = await readDirectoryEntriesOrEmpty(directoryPath);
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const filePaths = [];
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const nestedFiles = await listInstructionFiles(entryPath);
      filePaths.push(...nestedFiles);
    } else if (entry.isFile()) {
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
