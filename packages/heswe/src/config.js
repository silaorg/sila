import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const CONFIG_FILE_NAME = "config.json";

const WorkspaceConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
});

export class WorkspaceConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkspaceConfigError";
  }
}

export function getConfigPath(workspaceDir) {
  return path.join(workspaceDir, CONFIG_FILE_NAME);
}

export async function createDefaultConfig(workspaceDir, overrides = {}) {
  const configPath = getConfigPath(workspaceDir);
  const config = {
    version: 1,
    name: path.basename(workspaceDir),
    ...overrides,
  };
  const validated = WorkspaceConfigSchema.parse(config);
  await fs.writeFile(configPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
}

export async function readConfig(workspaceDir) {
  const configPath = getConfigPath(workspaceDir);
  let raw;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new WorkspaceConfigError(`Missing ${CONFIG_FILE_NAME} in: ${workspaceDir}`);
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WorkspaceConfigError(`Invalid JSON in ${configPath}`);
  }

  const result = WorkspaceConfigSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.length ? firstIssue.path.join(".") : "root";
    throw new WorkspaceConfigError(`Invalid ${CONFIG_FILE_NAME} in ${workspaceDir}: ${field} ${firstIssue.message}`);
  }

  return result.data;
}
