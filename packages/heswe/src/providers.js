import fs from "node:fs/promises";
import path from "node:path";
import { Lang } from "aiwrapper";
import { z } from "zod";
import { loadLandEnvironment, readEnvValue } from "./env.js";

const PROVIDERS_DIR_NAME = "providers";
const DEFAULT_AGENT_CONFIG_RELATIVE_PATH = path.join("agents", "default", "config.json");
const PROVIDER_CONFIG_FILE_NAME = "config.json";
const DEFAULT_PROVIDER_ID = "openai";

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

const LandProviderConfigSchema = z.looseObject({
  provider: z.string().trim().min(1).optional(),
  enabled: z.boolean().default(true),
  model: z.string().trim().min(1).optional(),
});

export class ProviderConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

export function getProvidersPath(landPath) {
  return path.join(landPath, PROVIDERS_DIR_NAME);
}

export function getProviderConfigPath(landPath, providerId) {
  return path.join(getProvidersPath(landPath), providerId, PROVIDER_CONFIG_FILE_NAME);
}

export function getDefaultAgentConfigPath(landPath) {
  return path.join(landPath, DEFAULT_AGENT_CONFIG_RELATIVE_PATH);
}

export async function createDefaultAgentConfig(landPath, overrides = {}) {
  const configPath = getDefaultAgentConfigPath(landPath);
  const config = DefaultAgentConfigSchema.parse({
    provider: "auto",
    model: "auto",
    ...overrides,
  });
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export async function createProviderConfig(landPath, providerId, overrides = {}) {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) {
    throw new ProviderConfigError("Provider id is required.");
  }

  const configPath = getProviderConfigPath(landPath, normalizedProviderId);
  const config = LandProviderConfigSchema.parse({
    provider: normalizedProviderId,
    enabled: true,
    ...overrides,
  });
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export async function readDefaultAgentConfig(landPath) {
  const configPath = getDefaultAgentConfigPath(landPath);
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

export async function readLandProviderConfigs(landPath) {
  const providersPath = getProvidersPath(landPath);
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

    const result = LandProviderConfigSchema.safeParse(parsed);
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

export async function resolveLandLanguageSelection(landPath) {
  await loadLandEnvironment(landPath);

  const agentConfig = await readDefaultAgentConfig(landPath);
  const providerConfigs = await readLandProviderConfigs(landPath);
  const requestedProviderId = normalizeProviderId(agentConfig.provider) ?? "auto";

  let selectedProviderId = requestedProviderId;
  if (requestedProviderId === "auto") {
    selectedProviderId = resolveAutoProviderId(providerConfigs);
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
  const implicitlyEnabled = isProviderImplicitlyEnabled(selectedProviderId, providerConfigs);
  if (!configuredProvider && !implicitlyEnabled && providerConfigs.length > 0 && requestedProviderId !== "auto") {
    throw new ProviderConfigError(
      `Provider "${selectedProviderId}" is not configured in ${getProvidersPath(landPath)}.`,
    );
  }

  const selectedModel = normalizeModelId(agentConfig.model) ?? normalizeModelId(configuredProvider?.model) ?? providerSpec.defaultModel;

  return {
    provider: selectedProviderId,
    model: selectedModel,
    apiKeyEnvName: providerSpec.envVarName,
  };
}

export async function loadLandLanguageProvider(landPath) {
  const selection = await resolveLandLanguageSelection(landPath);
  const providerSpec = getProviderSpec(selection.provider);
  if (!providerSpec) {
    throw new ProviderConfigError(`Unsupported provider "${selection.provider}".`);
  }

  const apiKey = selection.apiKeyEnvName ? readEnvValue(selection.apiKeyEnvName) : null;
  if (!providerSpec.local && !apiKey) {
    throw new ProviderConfigError(
      `missing ${selection.apiKeyEnvName} for provider "${selection.provider}" in ${landPath}. Set it in land .env or process env.`,
    );
  }

  return {
    ...selection,
    lang: createLanguageProvider(selection.provider, selection.model, apiKey, providerSpec),
  };
}

function resolveAutoProviderId(providerConfigs) {
  const providerIds = new Set();

  for (const config of providerConfigs) {
    if (config.enabled !== false) {
      providerIds.add(config.id);
    }
  }

  for (const providerId of Object.keys(PROVIDER_SPECS)) {
    if (isProviderImplicitlyEnabled(providerId, providerConfigs)) {
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

function isProviderImplicitlyEnabled(providerId, providerConfigs) {
  const providerSpec = getProviderSpec(providerId);
  if (!providerSpec || !providerSpec.envVarName) {
    return false;
  }

  const configuredProvider = providerConfigs.find((config) => config.id === providerId) ?? null;
  if (configuredProvider && configuredProvider.enabled === false) {
    return false;
  }

  return Boolean(readEnvValue(providerSpec.envVarName));
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
