import { Lang } from "aiwrapper";
import { providers } from "../providers";
import { getProviderModels } from "../tools/providerModels";
import { ProviderType, type ModelProviderConfig } from "../models";

/**
 * Selects the best model from a list of available models for a given provider.
 * Prioritizes the configured default model if available, otherwise falls back to the first model.
 *
 * Note: mirrors `AgentServices.getDefaultModelForProvider()`.
 */
export function getDefaultModelForProvider(
  provider: string,
  models: Array<{ id: string }>,
): string {
  const providerConfig = providers.find((p) => p.id === provider);
  if (providerConfig?.defaultModel) {
    if (!models.some((m) => m.id === providerConfig.defaultModel)) {
      console.warn(
        `Default model ${providerConfig.defaultModel} not found in models for provider ${provider}`,
      );
    }
    return providerConfig.defaultModel;
  }
  return models[0].id;
}

/**
 * Resolve "provider/auto" to a concrete model id for that provider.
 *
 * Note: mirrors `AgentServices.resolveAutoModel()` (270-303).
 */
export async function resolveAutoModelIdForProvider(
  provider: string,
): Promise<string> {
  // Special case for OpenRouter - use static provider config since models are entered manually
  if (provider === "openrouter") {
    const providerConfig = providers.find((p) => p.id === provider);
    if (providerConfig?.defaultModel) {
      return providerConfig.defaultModel;
    }
    throw new Error(`No default model configured for OpenRouter`);
  }

  // Try to use Lang.models first for cloud providers
  if (provider !== "ollama" && provider !== "local") {
    try {
      const models = Lang.models.fromProvider(provider);
      if (models && models.length > 0) {
        return getDefaultModelForProvider(provider, models);
      }
    } catch {
      // Fall back to legacy implementation
    }
  }

  // Fall back to legacy implementation
  const models = await getProviderModels(provider, "");
  if (models.length === 0) {
    throw new Error(`No models found for provider ${provider}`);
  }

  const providerConfig = providers.find((p) => p.id === provider);
  if (providerConfig?.defaultModel && models.includes(providerConfig.defaultModel)) {
    return providerConfig.defaultModel;
  }
  return models[0];
}

function isLanguageProviderId(providerId: string): boolean {
  const provider = providers.find((p) => p.id === providerId);
  // Unknown providers (e.g. custom or legacy ids) default to Language.
  return (provider?.type ?? ProviderType.Language) === ProviderType.Language;
}

/**
 * Resolve "auto" to the most capable configured language model.
 *
 * This mirrors `AgentServices.getMostCapableModel()` (93-176) and is used by:
 * - Agent runtime (core)
 * - UI display (client) to show what Auto will pick
 */
export async function resolveMostCapableLanguageModel(
  providerConfigs: ModelProviderConfig[],
  opts?: { providerOrder?: string[] },
): Promise<{ provider: string; model: string } | null> {
  const providerOrder =
    opts?.providerOrder ??
    [
      "openai",
      "anthropic",
      "google",
      "xai",
      "openrouter",
      "deepseek",
      "groq",
      "mistral",
      "ollama",
    ];

  // Sort configured providers by priority (custom providers always last vs built-ins)
  const sortedProviders = providerConfigs
    .map((config) => config.id)
    .sort((a, b) => {
      if (a.startsWith("custom-") && !b.startsWith("custom-")) return 1;
      if (!a.startsWith("custom-") && b.startsWith("custom-")) return -1;
      const indexA = providerOrder.indexOf(a);
      const indexB = providerOrder.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

  for (const providerId of sortedProviders) {
    const providerConfig = providerConfigs.find((c) => c.id === providerId);
    if (!providerConfig) continue;
    if (!isLanguageProviderId(providerId)) continue;

    // Custom providers: configured model id is stored on the config.
    if (providerId.startsWith("custom-")) {
      if ("modelId" in (providerConfig as any)) {
        const modelId = (providerConfig as any).modelId;
        if (typeof modelId === "string" && modelId.trim()) {
          return { provider: providerId, model: modelId.trim() };
        }
      }
      continue;
    }

    // Handle local providers
    if (providerConfig.type === "local") {
      try {
        const models = await getProviderModels(providerId, "");
        if (models && models.length > 0) {
          // @TODO: consider picking the most capable model from the list
          return { provider: providerId, model: models[0] };
        }
      } catch {
        // keep scanning
      }
      continue;
    }

    // Handle cloud providers
    try {
      // Try Lang.models first
      const models = Lang.models.fromProvider(providerId);
      if (models && models.length > 0) {
        const defaultModel = getDefaultModelForProvider(providerId, models);
        return { provider: providerId, model: defaultModel };
      }
    } catch {
      // Fall back to static provider config
    }

    // Special case for OpenRouter - use static provider config since models are entered manually
    if (providerId === "openrouter") {
      const staticProvider = providers.find((p) => p.id === providerId);
      if (staticProvider?.defaultModel) {
        return { provider: providerId, model: staticProvider.defaultModel };
      }
    }

    // Fall back to static provider config for other providers
    const staticProvider = providers.find((p) => p.id === providerId);
    if (staticProvider?.defaultModel) {
      return { provider: providerId, model: staticProvider.defaultModel };
    }
  }

  return null;
}

