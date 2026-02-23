import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CONFIG_FILE_NAME, createDefaultConfig } from "./config.js";

export const CreateLandOptionsSchema = z.object({
  path: z.string().min(1),
  openaiApiKey: z.string().min(1).optional(),
  secrets: z.array(z.object({ name: z.string().min(1), value: z.string() })).optional(),
  channel: z.string().min(1).default("telegram"),
}).strict();

export class CreateLandError extends Error {
  constructor(message) {
    super(message);
    this.name = "CreateLandError";
  }
}

function parseLandOptions(input) {
  const result = CreateLandOptionsSchema.safeParse(input);
  if (!result.success) {
    throw new CreateLandError(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
  }
  return result.data;
}

/** Creates a new land according to the options */
export async function createLand(options) {
  const parsedOptions = parseLandOptions(options);
  const landPath = path.resolve(parsedOptions.path);
  const existing = await statIfExists(landPath);

  if (existing && !existing.isDirectory()) {
    throw new CreateLandError(`Path exists and is not a directory: ${landPath}`);
  }

  if (existing) {
    throw new CreateLandError(`Land already exists at ${landPath}.`);
  }

  await fs.mkdir(landPath, { recursive: true });
  await createDefaultConfig(landPath);

  const providersPath = path.join(landPath, "providers");
  const agentsPath = path.join(landPath, "agents");
  const skillsPath = path.join(landPath, "skills");
  const assetsPath = path.join(landPath, "assets");
  const channelPath = path.join(landPath, "channels", parsedOptions.channel);

  await fs.mkdir(providersPath, { recursive: true });
  await fs.mkdir(agentsPath, { recursive: true });
  await fs.mkdir(skillsPath, { recursive: true });
  await fs.mkdir(assetsPath, { recursive: true });
  await fs.mkdir(channelPath, { recursive: true });

  await writeJsonFile(path.join(channelPath, CONFIG_FILE_NAME), buildChannelConfig(parsedOptions.channel));

  await writeJsonFile(path.join(providersPath, "openai.json"), {
    apiKey: parsedOptions.openaiApiKey ?? "",
  });

  if (parsedOptions.secrets?.length) {
    await writeJsonFile(path.join(landPath, "secrets.json"), parsedOptions.secrets);
  }

  return {
    landPath,
    channel: parsedOptions.channel,
    openaiConfigured: Boolean(parsedOptions.openaiApiKey),
    secretCount: parsedOptions.secrets?.length ?? 0,
  };
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function buildChannelConfig(channel) {
  if (channel === "slack") {
    return {
      channel: "slack",
      enabled: true,
      mode: "socket",
      botUserOAuthToken: "",
      appLevelToken: "",
      aiModel: "gpt-5.2",
    };
  }

  if (channel === "telegram") {
    return {
      channel: "telegram",
      enabled: true,
      botToken: "",
      aiModel: "gpt-5.2",
    };
  }

  return { channel };
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
