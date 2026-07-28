import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DOT_ENV_FILE_NAME = ".env";

export function getWorkspaceEnvPath(workspacePath) {
  return path.join(workspacePath, DOT_ENV_FILE_NAME);
}

export async function readWorkspaceEnvironment(workspacePath) {
  return await readDotEnvFile(getWorkspaceEnvPath(workspacePath)) ?? {};
}

export async function readWorkspaceEnvValue(workspacePath, name) {
  const environment = await readWorkspaceEnvironment(workspacePath);
  const value = environment[name];
  const workspaceValue = typeof value === "string" && value.trim() ? value.trim() : null;
  return workspaceValue ?? readEnvValue(name);
}

export async function updateWorkspaceEnvironment(workspacePath, changes) {
  const entries = Object.entries(changes ?? {});
  if (!entries.length) {
    return;
  }

  const normalizedChanges = new Map(entries.map(([name, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      throw new Error(`Invalid environment variable name: ${name}`);
    }
    if (value !== null && typeof value !== "string") {
      throw new Error(`Environment value for ${name} must be a string or null.`);
    }
    const normalizedValue = typeof value === "string" ? value.trim() : null;
    if (normalizedValue && /[\u0000\r\n]/.test(normalizedValue)) {
      throw new Error(`Environment value for ${name} contains unsupported characters.`);
    }
    return [name, normalizedValue || null];
  }));

  const envPath = getWorkspaceEnvPath(workspacePath);
  const existing = await readTextFileOrEmpty(envPath);
  const written = new Set();
  const lines = existing.split(/\r?\n/).flatMap((line) => {
    const name = readAssignmentName(line);
    if (!name || !normalizedChanges.has(name)) {
      return [line];
    }
    if (written.has(name)) {
      return [];
    }
    written.add(name);
    const value = normalizedChanges.get(name);
    return value === null ? [] : [`${name}=${JSON.stringify(value)}`];
  });

  while (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }
  for (const [name, value] of normalizedChanges) {
    if (!written.has(name) && value !== null) {
      lines.push(`${name}=${JSON.stringify(value)}`);
    }
  }

  await fs.mkdir(workspacePath, { recursive: true });
  const temporaryPath = `${envPath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${lines.join("\n")}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(temporaryPath, envPath);
    await fs.chmod(envPath, 0o600);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

export function readEnvValue(name) {
  if (typeof process.env[name] !== "string") {
    return null;
  }
  const trimmed = process.env[name].trim();
  return trimmed.length ? trimmed : null;
}

async function readDotEnvFile(filePath) {
  const raw = await readTextFileOrNull(filePath);
  if (raw === null) return null;
  return parseDotEnv(raw);
}

function parseDotEnv(raw) {
  const out = {};
  const lines = String(raw).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equals = line.indexOf("=");
    if (equals <= 0) {
      continue;
    }

    const key = line.slice(0, equals).trim();
    if (!key) {
      continue;
    }

    const valueRaw = line.slice(equals + 1).trim();
    out[key] = parseDotEnvValue(valueRaw);
  }
  return out;
}

function parseDotEnvValue(valueRaw) {
  if (valueRaw.startsWith('"') && valueRaw.endsWith('"') && valueRaw.length >= 2) {
    try {
      return JSON.parse(valueRaw);
    } catch {
      return valueRaw.slice(1, -1).replace(/\\n/g, "\n");
    }
  }
  if (valueRaw.startsWith("'") && valueRaw.endsWith("'") && valueRaw.length >= 2) {
    return valueRaw.slice(1, -1);
  }

  const hashIndex = valueRaw.indexOf(" #");
  if (hashIndex >= 0) {
    return valueRaw.slice(0, hashIndex).trim();
  }
  return valueRaw;
}

function readAssignmentName(line) {
  const equals = line.indexOf("=");
  if (equals <= 0) return null;
  const name = line.slice(0, equals).trim();
  return /^[A-Z][A-Z0-9_]*$/.test(name) ? name : null;
}

async function readTextFileOrEmpty(filePath) {
  return await readTextFileOrNull(filePath) ?? "";
}

async function readTextFileOrNull(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
