#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import pc from "picocolors";
import {
  CONFIG_FILE_NAME,
  LandConfigError,
  createDefaultConfig,
  getConfigPath,
  readConfig,
} from "./config.js";
import { CreateLandError, createLand } from "./create-land.js";
import { Land } from "./land.js";

const USAGE = `Usage:
  silaland create [path] [--channel telegram] [--openai-api-key <key>] [--secret NAME=VALUE]
  silaland run [path] [--watch]

Commands:
  create   Create a land directory and config.json.
  run      Run a land directory (bootstraps config.json only for new/empty dirs).

Options:
  -c, --channel <name>    Channel to scaffold for create.
  -k, --openai-api-key <key>
                           OpenAI API key to write into .env as OPENAI_API_KEY.
  -s, --secret <kv>       Secret in NAME=VALUE format. Can be repeated.
  -w, --watch             Enable watch mode for run.
  -h, --help              Show help.
`;

async function main() {
  const argv = process.argv.slice(2);
  const [command, ...commandArgs] = argv;

  if (!command) {
    throw usageError("Command is required.");
  }

  if (command === "-h" || command === "--help") {
    printUsage();
    return;
  }

  if (command === "create") {
    await handleCreate(commandArgs);
    return;
  }

  if (command === "run") {
    await handleRun(commandArgs);
    return;
  }

  throw usageError(`Unknown command: ${command}`);
}

async function handleCreate(args) {
  const { values, positionals } = parseCommandArgs(args, {
    channel: { type: "string", short: "c" },
    "openai-api-key": { type: "string", short: "k" },
    secret: { type: "string", short: "s", multiple: true },
    help: { type: "boolean", short: "h" },
  });

  if (values.help) {
    printUsage();
    return;
  }

  if (positionals.length > 1) {
    throw usageError("Too many positional arguments for create.");
  }

  const landDir = resolveLandDir(positionals[0]);
  const secrets = parseSecretOptions(values.secret ?? []);

  try {
    const created = await createLand({
      path: landDir,
      channel: values.channel,
      openaiApiKey: values["openai-api-key"],
      secrets,
    });
    logSuccess(`Created land at: ${created.landPath}`);
    logInfo(`Scaffolded channel: ${created.channel}`);
    if (created.openaiConfigured) {
      logInfo("Configured OPENAI_API_KEY in .env.");
    } else {
      logInfo("Scaffolded .env file. Set OPENAI_API_KEY and EXA_API_KEY there.");
    }
    if (created.secretCount) {
      logInfo(`Stored ${created.secretCount} secret(s).`);
    }
  } catch (error) {
    if (error instanceof CreateLandError) {
      throw usageError(error.message);
    }
    throw error;
  }
}

async function handleRun(args) {
  const { values, positionals } = parseCommandArgs(args, {
    watch: { type: "boolean", short: "w" },
    help: { type: "boolean", short: "h" },
  });

  if (values.help) {
    printUsage();
    return;
  }

  if (positionals.length > 1) {
    throw usageError("Too many positional arguments for run.");
  }

  const landDir = resolveLandDir(positionals[0]);
  const existing = await statIfExists(landDir);
  if (existing && !existing.isDirectory()) {
    throw new Error(`Path exists and is not a directory: ${landDir}`);
  }

  let createdDir = false;
  if (!existing) {
    await fs.mkdir(landDir, { recursive: true });
    createdDir = true;
    logSuccess(`Created land at: ${landDir}`);
  }

  const configPath = getConfigPath(landDir);
  const configStat = await statIfExists(configPath);
  if (!configStat) {
    if (createdDir || (await isDirectoryEmpty(landDir))) {
      await createDefaultConfig(landDir);
      logSuccess(`Created ${CONFIG_FILE_NAME} at: ${configPath}`);
    } else {
      throw usageError(`Missing ${CONFIG_FILE_NAME} in non-empty directory: ${landDir}. Point to an empty path or to a path with an existing ${CONFIG_FILE_NAME}.`);
    }
  } else if (!configStat.isFile()) {
    throw usageError(`${CONFIG_FILE_NAME} exists but is not a file: ${configPath}`);
  }

  try {
    await readConfig(landDir);
  } catch (error) {
    if (error instanceof LandConfigError) {
      throw usageError(error.message);
    }
    throw error;
  }

  const land = new Land(landDir);
  land.run().catch((error) => {
    logError(`Failed to run land: ${error.message}`);
    process.exitCode = 1;
  });

  if (values.watch) {
    logInfo("Watch mode enabled.");
  }
}

function parseCommandArgs(args, options) {
  try {
    return parseArgs({ args, allowPositionals: true, options });
  } catch (error) {
    throw usageError(error.message);
  }
}

function parseSecretOptions(secretArgs) {
  if (!secretArgs.length) {
    return undefined;
  }

  return secretArgs.map((secretArg) => {
    const separator = secretArg.indexOf("=");
    if (separator <= 0) {
      throw usageError(`Invalid --secret value "${secretArg}". Expected NAME=VALUE.`);
    }
    return {
      name: secretArg.slice(0, separator),
      value: secretArg.slice(separator + 1),
    };
  });
}

function resolveLandDir(maybePath) {
  return path.resolve(maybePath ?? process.cwd());
}

async function statIfExists(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function isDirectoryEmpty(dirPath) {
  const entries = await fs.readdir(dirPath);
  return entries.length === 0;
}

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function printUsage() {
  console.log(pc.bold("silaland"));
  console.log(pc.dim(USAGE.trim()));
}

function logInfo(message) {
  console.log(pc.cyan(`info: ${message}`));
}

function logSuccess(message) {
  console.log(pc.green(`ok: ${message}`));
}

function logError(message) {
  console.error(pc.red(`error: ${message}`));
}

main().catch((error) => {
  logError(error.message);
  if (error.exitCode === 2) {
    console.error("");
    printUsage();
  }
  process.exitCode = error.exitCode ?? 1;
});
