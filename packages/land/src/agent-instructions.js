import fs from "node:fs/promises";
import path from "node:path";
import {
  buildManagedInstructionBlocks,
  defaultAgentInstructions,
  defaultSlackInstructions,
  defaultTelegramInstructions,
} from "@sila/agents";

const DEFAULT_INSTRUCTIONS_PATH = path.join("agents", "default", "instructions.md");

/**
 * @param {string} landPath
 * @param {string} channel
 * @returns {Promise<string>}
 */
export async function loadLandAgentInstructions(landPath, channel) {
  const overridePath = path.join(landPath, DEFAULT_INSTRUCTIONS_PATH);
  const override = await readFileOrNull(overridePath);
  if (override && override.trim().length) {
    return [override.trim(), buildManagedInstructionBlocks(channel).trim()].join("\n\n");
  }

  const normalizedChannel = typeof channel === "string" ? channel.trim().toLowerCase() : "";
  if (normalizedChannel === "slack") {
    return defaultSlackInstructions();
  }
  if (normalizedChannel === "telegram") {
    return defaultTelegramInstructions();
  }
  return defaultAgentInstructions();
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
