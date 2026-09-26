import fs from "node:fs/promises";
import path from "node:path";
import { Lang } from "aiwrapper";
import { z } from "zod";
import {
  readEnvValue,
  readWorkspaceEnvironment,
  readWorkspaceEnvValue,
  updateWorkspaceEnvironment,
} from "./env.js";

const PROVIDERS_DIR_NAME = "providers";
const DEFAULT_AGENT_CONFIG_RELATIVE_PATH = path.join("agents", "default", "config.json");
const PROVIDER_CONFIG_FILE_NAME = "config.json";
const DEFAULT_PROVIDER_ID = "openai";
export const PROVIDER_CONFIG_ERROR_CODE = "provider_config";
const PROVIDER_LABELS = Object.freeze({
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  kimi: "Kimi",
  xai: "xAI",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  groq: "Groq",
  cohere: "Cohere",
  mistral: "Mistral",
  ollama: "Ollama",
  falai: "Fal.ai",
  exa: "Exa",
});

const PROVIDER_SPECS = Object.freeze({
  openai: Object.freeze({
    envVarName: "OPENAI_API_KEY",
    defaultModel: "gpt-5.4",
    priority: 0,
    kind: "language",
  }),
  anthropic: Object.freeze({
    envVarName: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6",
    priority: 1,
    kind: "language",
  }),
  google: Object.freeze({
    envVarName: "GOOGLE_API_KEY",
    defaultModel: "gemini-2.5-pro",
    priority: 2,
    kind: "language",
  }),
  kimi: Object.freeze({
    envVarName: "KIMI_API_KEY",
    defaultModel: "kimi-k2.5",
    priority: 3,
    kind: "language",
    baseURL: "https://api.moonshot.cn/v1",
  }),
  xai: Object.freeze({
    envVarName: "XAI_API_KEY",
    defaultModel: "grok-4-1-fast",
    priority: 4,
    kind: "language",
  }),
  openrouter: Object.freeze({
    envVarName: "OPENROUTER_API_KEY",
    defaultModel: "openai/gpt-5.4",
    priority: 5,
    kind: "language",
  }),
  deepseek: Object.freeze({
    envVarName: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    priority: 6,
    kind: "language",
  }),
  groq: Object.freeze({
    envVarName: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    priority: 7,
    kind: "language",
  }),
  cohere: Object.freeze({
    envVarName: "COHERE_API_KEY",
    defaultModel: "command-r-plus",
    priority: 8,
    kind: "language",
  }),
  mistral: Object.freeze({
    envVarName: "MISTRAL_API_KEY",
    defaultModel: "mistral-large-latest",
    priority: 9,
    kind: "language",
  }),
  ollama: Object.freeze({
    envVarName: null,
    defaultModel: "llama2:latest",
    priority: 10,
    kind: "language",
    local: true,
  }),
  falai: Object.freeze({
    envVarName: "FAL_KEY",
    defaultModel: null,
    priority: 999,
    kind: "viz",
  }),
  exa: Object.freeze({
    envVarName: "EXA_API_KEY",
    defaultModel: null,
    priority: 999,
    kind: "search",
  }),
});

const DefaultAgentConfigSchema = z.looseObject({
  provider: z.string().trim().min(1).default("auto"),
  model: z.string().trim().min(1).default("auto"),
});

const WorkspaceProviderConfigSchema = z.looseObject({
  provider: z.string().trim().min(1).optional(),
  enabled: z.boolean().default(true),
  model: z.string().trim().min(1).optional(),
});

const ModelSettingsUpdateSchema = z.strictObject({
  provider: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(200),
  apiKeys: z.record(
    z.string(),
    z.union([z.string().trim().max(10_000), z.null()]),
  ).default({}),
});

export class ProviderConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProviderConfigError";
    this.code = PROVIDER_CONFIG_ERROR_CODE;
  }
}

export function getProvidersPath(workspacePath) {
  return path.join(workspacePath, PROVIDERS_DIR_NAME);
}

export function getProviderConfigPath(workspacePath, providerId) {
  return path.join(getProvidersPath(workspacePath), providerId, PROVIDER_CONFIG_FILE_NAME);
}

export function getDefaultAgentConfigPath(workspacePath) {
  return path.join(workspacePath, DEFAULT_AGENT_CONFIG_RELATIVE_PATH);
}

export async function createDefaultAgentConfig(workspacePath, overrides = {}) {
  const configPath = getDefaultAgentConfigPath(workspacePath);
  const config = DefaultAgentConfigSchema.parse({
    provider: "auto",
    model: "auto",
    ...overrides,
  });
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export async function createProviderConfig(workspacePath, providerId, overrides = {}) {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) {
    throw new ProviderConfigError("Provider id is required.");
  }

  const configPath = getProviderConfigPath(workspacePath, normalizedProviderId);
  const config = WorkspaceProviderConfigSchema.parse({
    provider: normalizedProviderId,
    enabled: true,
    ...overrides,
  });
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export async function readDefaultAgentConfig(workspacePath) {
  const configPath = getDefaultAgentConfigPath(workspacePath);
  const parsed = await readJsonFileOrNull(configPath);
  if (!parsed) {
    return DefaultAgentConfigSchema.parse({});
  }

  const result = DefaultAgentConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProviderConfigError(`Invalid default agent config at ${configPath}.`);
  }
  return result.data;
}

export async function readWorkspaceProviderConfigs(workspacePath) {
  const providersPath = getProvidersPath(workspacePath);
  const entries = await readDirectoryEntriesOrEmpty(providersPath);
  const configs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const configPath = path.join(providersPath, entry.name, PROVIDER_CONFIG_FILE_NAME);
    const parsed = await readJsonFileOrNull(configPath);
    if (!parsed) {
      continue;
    }

    const result = WorkspaceProviderConfigSchema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderConfigError(`Invalid provider config at ${configPath}.`);
    }

    const providerId = normalizeProviderId(result.data.provider ?? entry.name);
    if (!providerId) {
      throw new ProviderConfigError(`Missing provider id in ${configPath}.`);
    }

    configs.push({
      id: providerId,
      enabled: result.data.enabled,
      model: result.data.model,
      path: configPath,
    });
  }

  return configs;
}

export async function readWorkspaceModelSettings(workspacePath) {
  const [agentConfig, providerConfigs, workspaceEnvironment] = await Promise.all([
    readDefaultAgentConfig(workspacePath),
    readWorkspaceProviderConfigs(workspacePath),
    readWorkspaceEnvironment(workspacePath),
  ]);
  const configsById = new Map(providerConfigs.map((config) => [config.id, config]));

  return {
    provider: agentConfig.provider,
    model: agentConfig.model,
    providers: Object.entries(PROVIDER_SPECS).map(([id, spec]) => {
      const workspaceKey = spec.envVarName
        ? normalizeEnvironmentValue(workspaceEnvironment[spec.envVarName])
        : null;
      const serverKey = spec.envVarName ? readEnvValue(spec.envVarName) : null;
      const config = configsById.get(id);
      return {
        id,
        name: PROVIDER_LABELS[id] ?? id,
        kind: spec.kind,
        local: Boolean(spec.local),
        defaultModel: spec.defaultModel,
        model: config?.model ?? null,
        enabled: config?.enabled ?? null,
        apiKeySource: workspaceKey ? "workspace" : serverKey ? "server" : "none",
      };
    }),
  };
}

export async function updateWorkspaceModelSettings(workspacePath, input) {
  const result = ModelSettingsUpdateSchema.safeParse(input);
  if (!result.success) {
    throw new ProviderConfigError(
      result.error.issues.map((issue) => issue.message).join(" "),
    );
  }

  const { provider, model, apiKeys } = result.data;
  if (provider !== "auto") {
    const providerSpec = getProviderSpec(provider);
    if (!providerSpec || providerSpec.kind !== "language") {
      throw new ProviderConfigError(`Unsupported language provider "${provider}".`);
    }
    await createProviderConfig(workspacePath, provider);
  }

  const environmentChanges = {};
  for (const [providerId, value] of Object.entries(apiKeys)) {
    const providerSpec = getProviderSpec(providerId);
    if (!providerSpec?.envVarName) {
      throw new ProviderConfigError(`Provider "${providerId}" does not accept an API key.`);
    }
    environmentChanges[providerSpec.envVarName] = value;
  }

  await createDefaultAgentConfig(workspacePath, {
    provider,
    model: provider === "auto" ? "auto" : model,
  });
  await updateWorkspaceEnvironment(workspacePath, environmentChanges);
  return readWorkspaceModelSettings(workspacePath);
}

export async function resolveWorkspaceLanguageSelection(workspacePath) {
  const [agentConfig, providerConfigs, workspaceEnvironment] = await Promise.all([
    readDefaultAgentConfig(workspacePath),
    readWorkspaceProviderConfigs(workspacePath),
    readWorkspaceEnvironment(workspacePath),
  ]);
  const requestedProviderId = normalizeProviderId(agentConfig.provider) ?? "auto";

  let selectedProviderId = requestedProviderId;
  if (requestedProviderId === "auto") {
    selectedProviderId = resolveAutoProviderId(providerConfigs, workspaceEnvironment);
  }

  const providerSpec = getProviderSpec(selectedProviderId);
  if (!providerSpec) {
    throw new ProviderConfigError(`Unsupported provider "${selectedProviderId}".`);
  }
  if (providerSpec.kind !== "language") {
    throw new ProviderConfigError(`Provider "${selectedProviderId}" is not a language provider.`);
  }

  const configuredProvider = providerConfigs.find((config) => config.id === selectedProviderId) ?? null;
  if (configuredProvider && configuredProvider.enabled === false) {
    throw new ProviderConfigError(`Provider "${selectedProviderId}" is disabled.`);
  }
  const implicitlyEnabled = isProviderImplicitlyEnabled(
    selectedProviderId,
    providerConfigs,
    workspaceEnvironment,
  );
  if (!configuredProvider && !implicitlyEnabled && providerConfigs.length > 0 && requestedProviderId !== "auto") {
    throw new ProviderConfigError(
      `Provider "${selectedProviderId}" is not configured in ${getProvidersPath(workspacePath)}.`,
    );
  }

  const selectedModel = normalizeModelId(agentConfig.model) ?? normalizeModelId(configuredProvider?.model) ?? providerSpec.defaultModel;

  return {
    provider: selectedProviderId,
    model: selectedModel,
    apiKeyEnvName: providerSpec.envVarName,
  };
}

export async function loadWorkspaceLanguageProvider(workspacePath) {
  const selection = await resolveWorkspaceLanguageSelection(workspacePath);
  const providerSpec = getProviderSpec(selection.provider);
  if (!providerSpec) {
    throw new ProviderConfigError(`Unsupported provider "${selection.provider}".`);
  }

  const apiKey = selection.apiKeyEnvName
    ? await readWorkspaceEnvValue(workspacePath, selection.apiKeyEnvName)
    : null;
  if (!providerSpec.local && !apiKey) {
    throw new ProviderConfigError(
      `missing ${selection.apiKeyEnvName} for provider "${selection.provider}" in ${workspacePath}. Set it in workspace .env or process env.`,
    );
  }

  return {
    ...selection,
    lang: createLanguageProvider(selection.provider, selection.model, apiKey, providerSpec),
  };
}

function resolveAutoProviderId(providerConfigs, workspaceEnvironment) {
  const providerIds = new Set();

  for (const config of providerConfigs) {
    if (config.enabled !== false) {
      providerIds.add(config.id);
    }
  }

  for (const providerId of Object.keys(PROVIDER_SPECS)) {
    if (isProviderImplicitlyEnabled(providerId, providerConfigs, workspaceEnvironment)) {
      providerIds.add(providerId);
    }
  }

  const supportedConfiguredProviders = Array.from(providerIds).filter((providerId) => {
    const providerSpec = getProviderSpec(providerId);
    return providerSpec && providerSpec.kind === "language";
  });

  if (!supportedConfiguredProviders.length) {
    return DEFAULT_PROVIDER_ID;
  }

  supportedConfiguredProviders.sort((a, b) => {
    return getProviderSpec(a).priority - getProviderSpec(b).priority;
  });

  return supportedConfiguredProviders[0];
}

function getProviderSpec(providerId) {
  if (!providerId || !Object.prototype.hasOwnProperty.call(PROVIDER_SPECS, providerId)) {
    return null;
  }
  return PROVIDER_SPECS[providerId];
}

function createLanguageProvider(providerId, model, apiKey, providerSpec) {
  if (providerId === "kimi") {
    return Lang.openaiLike({
      apiKey,
      model,
      baseURL: providerSpec.baseURL,
    });
  }

  if (providerId === "ollama") {
    return Lang.ollama({ model });
  }

  const providerFactory = Lang[providerId];
  if (typeof providerFactory !== "function") {
    throw new ProviderConfigError(`Provider "${providerId}" is not available in aiwrapper.`);
  }

  return providerFactory({
    ...(apiKey ? { apiKey } : {}),
    model,
  });
}

function isProviderImplicitlyEnabled(providerId, providerConfigs, workspaceEnvironment) {
  const providerSpec = getProviderSpec(providerId);
  if (!providerSpec || !providerSpec.envVarName) {
    return false;
  }

  const configuredProvider = providerConfigs.find((config) => config.id === providerId) ?? null;
  if (configuredProvider && configuredProvider.enabled === false) {
    return false;
  }

  return Boolean(
    readEnvValue(providerSpec.envVarName)
    ?? normalizeEnvironmentValue(workspaceEnvironment[providerSpec.envVarName]),
  );
}

function normalizeEnvironmentValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeProviderId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

function normalizeModelId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized.length || normalized.toLowerCase() === "auto") {
    return null;
  }
  return normalized;
}

async function readDirectoryEntriesOrEmpty(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readJsonFileOrNull(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ProviderConfigError(`Invalid JSON in ${filePath}.`);
  }
}
