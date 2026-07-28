import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CONFIG_FILE_NAME, createDefaultConfig } from "./config.js";
import { getWorkspaceEnvPath } from "./env.js";
import { createDefaultAgentConfig, createProviderConfig } from "./providers.js";

export const CreateWorkspaceOptionsSchema = z.object({
  path: z.string().min(1),
  openaiApiKey: z.string().min(1).optional(),
  secrets: z.array(z.object({ name: z.string().min(1), value: z.string() })).optional(),
  channel: z.enum(["slack", "telegram"]).default("telegram"),
}).strict();

export class CreateWorkspaceError extends Error {
  constructor(message) {
    super(message);
    this.name = "CreateWorkspaceError";
  }
}

function parseWorkspaceOptions(input) {
  const result = CreateWorkspaceOptionsSchema.safeParse(input);
  if (!result.success) {
    throw new CreateWorkspaceError(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
  }
  return result.data;
}

/** Creates a new workspace according to the options */
export async function createWorkspace(options) {
  const parsedOptions = parseWorkspaceOptions(options);
  const workspacePath = path.resolve(parsedOptions.path);
  const existing = await statIfExists(workspacePath);

  if (existing && !existing.isDirectory()) {
    throw new CreateWorkspaceError(`Path exists and is not a directory: ${workspacePath}`);
  }

  if (existing) {
    throw new CreateWorkspaceError(`Workspace already exists at ${workspacePath}.`);
  }

  await fs.mkdir(workspacePath, { recursive: true });
  await createDefaultConfig(workspacePath);

  const agentsPath = path.join(workspacePath, "agents");
  const defaultAgentPath = path.join(agentsPath, "default");
  const skillsPath = path.join(workspacePath, "skills");
  const assetsPath = path.join(workspacePath, "assets");
  const providersPath = path.join(workspacePath, "providers");
  const channelPath = path.join(workspacePath, "channels", parsedOptions.channel);

  await fs.mkdir(agentsPath, { recursive: true });
  await fs.mkdir(defaultAgentPath, { recursive: true });
  await fs.mkdir(skillsPath, { recursive: true });
  await fs.mkdir(assetsPath, { recursive: true });
  await fs.mkdir(providersPath, { recursive: true });
  await fs.mkdir(channelPath, { recursive: true });

  await createDefaultAgentConfig(workspacePath);
  await createProviderConfig(workspacePath, "openai");
  await writeJsonFile(path.join(channelPath, CONFIG_FILE_NAME), buildChannelConfig(parsedOptions.channel));
  await fs.writeFile(getWorkspaceEnvPath(workspacePath), buildWorkspaceEnv(parsedOptions), "utf8");

  if (parsedOptions.secrets?.length) {
    await writeJsonFile(path.join(workspacePath, "secrets.json"), parsedOptions.secrets);
  }

  return {
    workspacePath,
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
      botUserOAuthToken: "",
      appLevelToken: "",
    };
  }

  return {
    channel: "telegram",
    enabled: true,
    botToken: "",
  };
}

function buildWorkspaceEnv(options) {
  const openAiApiKey = options.openaiApiKey ?? "";
  return [
    "# AI provider keys for this workspace",
    `OPENAI_API_KEY=${openAiApiKey}`,
    "ANTHROPIC_API_KEY=",
    "GOOGLE_API_KEY=",
    "KIMI_API_KEY=",
    "XAI_API_KEY=",
    "OPENROUTER_API_KEY=",
    "DEEPSEEK_API_KEY=",
    "GROQ_API_KEY=",
    "COHERE_API_KEY=",
    "MISTRAL_API_KEY=",
    "FAL_KEY=",
    "EXA_API_KEY=",
    "",
  ].join("\n");
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
