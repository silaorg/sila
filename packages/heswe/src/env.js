import fs from "node:fs/promises";
import path from "node:path";

const DOT_ENV_FILE_NAME = ".env";

export function getLandEnvPath(landPath) {
  return path.join(landPath, DOT_ENV_FILE_NAME);
}

export async function loadLandEnvironment(landPath) {
  const envPath = getLandEnvPath(landPath);

  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
      return;
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  const parsed = await readDotEnvFile(envPath);
  if (!parsed) {
    return;
  }

  for (const [name, value] of Object.entries(parsed)) {
    if (typeof process.env[name] === "undefined") {
      process.env[name] = value;
    }
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
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

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
    return valueRaw.slice(1, -1).replace(/\\n/g, "\n");
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
