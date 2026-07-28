import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const CONFIG_FILE_NAME = "config.json";

const LandConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
});

export class LandConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "LandConfigError";
  }
}

export function getConfigPath(landDir) {
  return path.join(landDir, CONFIG_FILE_NAME);
}

export async function createDefaultConfig(landDir) {
  const configPath = getConfigPath(landDir);
  const config = {
    version: 1,
    name: path.basename(landDir),
  };
  const validated = LandConfigSchema.parse(config);
  await fs.writeFile(configPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
}

export async function readConfig(landDir) {
  const configPath = getConfigPath(landDir);
  let raw;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new LandConfigError(`Missing ${CONFIG_FILE_NAME} in: ${landDir}`);
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LandConfigError(`Invalid JSON in ${configPath}`);
  }

  const result = LandConfigSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.length ? firstIssue.path.join(".") : "root";
    throw new LandConfigError(`Invalid ${CONFIG_FILE_NAME} in ${landDir}: ${field} ${firstIssue.message}`);
  }

  return result.data;
}
