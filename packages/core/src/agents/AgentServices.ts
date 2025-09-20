import { Lang, LanguageProvider } from 'aiwrapper';
import { providers } from "../providers";
import { Space } from '../spaces/Space';
import { getProviderModels } from '../tools/providerModels';
import { splitModelString } from '../utils/modelUtils';

export class AgentServices {
  readonly space: Space;
  private lastResolvedProvider: string | null = null;
  private lastResolvedModel: string | null = null;

  constructor(space: Space) {
    this.space = space;
  }

  async lang(model?: string): Promise<LanguageProvider> {
    let modelProvider: string;
    let modelName: string;

    // When a model is specified, split it into provider and model name
    // e.g model = openai/o3 or ollama/auto or custom-uuid/openai/gpt-4
    if (model && !model.startsWith("auto")) {
      const modelParts = splitModelString(model);
      if (!modelParts) {
        throw new Error("Invalid model name");
      }

      modelProvider = modelParts.providerId;
      modelName = modelParts.modelId;

      // If the provider is set but the model is "auto", find a model within the provider
      // e.g model = ollama/auto
      if (modelName.endsWith("auto")) {
        modelName = await this.resolveAutoModel(modelProvider);
      }
    }
    // When no provider is specified, find the most capable model from a provider
    // model = "auto" or undefined
    else {
      const mostCapableModel = await this.getMostCapableModel();

      if (mostCapableModel === null) {
        throw new Error("No capable model found");
      }

      modelProvider = mostCapableModel.provider;
      modelName = mostCapableModel.model;
    }

    this.lastResolvedProvider = modelProvider;
    this.lastResolvedModel = modelName;
    return this.createLanguageProvider(modelProvider, modelName);
  }

  private async createLanguageProvider(provider: string, model: string): Promise<LanguageProvider> {
    // Common configuration for API-based providers
    const options: Record<string, any> = { model };

    // Add API key for providers that require it (all except ollama)
    if (provider !== "ollama") {
      options.apiKey = await this.getKey(provider);
    }

    // Handle custom OpenAI-like providers
    if (provider.startsWith('custom-')) {
      const config = this.space.getModelProviderConfig(provider);
      if (!config || !('baseApiUrl' in config)) {
        throw new Error(`Invalid custom provider configuration for: ${provider}`);
      }

      // Create a custom OpenAI-like provider
      return Lang.openaiLike({
        apiKey: options.apiKey,
        model: model,
        baseURL: config.baseApiUrl as string,
        headers: ('customHeaders' in config) ? config.customHeaders as Record<string, string> : undefined
      });
    }

    // Check if the provider method exists on Lang
    if (typeof Lang[provider as keyof typeof Lang] === 'function') {
      // Dynamically call the provider method with the options
      return Lang[provider as keyof typeof Lang](options);
    }

    throw new Error(`Invalid model provider: ${provider}`);
  }

  getLastResolvedModel(): { provider: string; model: string } | null {
    if (this.lastResolvedProvider && this.lastResolvedModel) {
      return { provider: this.lastResolvedProvider, model: this.lastResolvedModel };
    }
    return null;
  }

  async getKey(provider: string): Promise<string> {
    const providerConfig = this.space.getModelProviderConfig(provider);

    if (!providerConfig) {
      throw new Error("No provider config found");
    }

    // First check if config itself contains 'apiKey'
    if ("apiKey" in providerConfig) {
      return providerConfig.apiKey as string;
    }

    // @NOTE: consider adding checks in other parts, such as user profile

    throw new Error("No API key found");
  }

  async getMostCapableModel(): Promise<
    { provider: string; model: string } | null
  > {
    const providerConfigs = this.space.getModelProviderConfigs();
    const providerOrder = ["openrouter", "openai", "anthropic", "google", "xai", "deepseek", "groq", "mistral", "ollama"];

    // Sort configured providers by priority
    const sortedProviders = providerConfigs
      .map(config => config.id)
      .sort((a, b) => {
        // Custom providers get lower priority than built-in ones
        if (a.startsWith('custom-') && !b.startsWith('custom-')) return 1;
        if (!a.startsWith('custom-') && b.startsWith('custom-')) return -1;

        const indexA = providerOrder.indexOf(a);
        const indexB = providerOrder.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

    for (const provider of sortedProviders) {
      const providerConfig = this.space.getModelProviderConfig(provider);
      if (!providerConfig) continue;

      // Handle custom providers
      if (provider.startsWith('custom-')) {
        if ('modelId' in providerConfig) {
          return {
            provider,
            model: providerConfig.modelId as string
          };
        }
        continue;
      }

      // Handle local providers
      if (providerConfig.type === "local") {
        const models = await getProviderModels(provider, "");
        if (models && models.length > 0) {
          return {
            provider,
            model: models[0] // @TODO: consider picking the most capable model from the list
          };
        }
        continue;
      }

      // Handle cloud providers
      try {
        // Try Lang.models first
        const models = Lang.models.fromProvider(provider);
        if (models && models.length > 0) {
          const defaultModel = this.getDefaultModelForProvider(provider, models);
          return {
            provider,
            model: defaultModel
          };
        }
      } catch (error) {
        // Fall back to static provider config
      }
      
      // Special case for OpenRouter - use static provider config since models are entered manually
      if (provider === "openrouter") {
        const staticProvider = providers.find(p => p.id === provider);
        if (staticProvider?.defaultModel) {
          return {
            provider,
            model: staticProvider.defaultModel
          };
        }
      }
      
      // Fall back to static provider config for other providers
      const staticProvider = providers.find(p => p.id === provider);
      if (staticProvider?.defaultModel) {
        return {
          provider,
          model: staticProvider.defaultModel
        };
      }
    }

    return null;
  }

  /**
   * Selects the best model from a list of available models for a given provider.
   * Prioritizes the configured default model if available, otherwise falls back to the first model.
   */
  private getDefaultModelForProvider(provider: string, models: any[]): string {
    const providerConfig = providers.find(p => p.id === provider);
    if (providerConfig?.defaultModel && models.some(m => m.id === providerConfig.defaultModel)) {
      return providerConfig.defaultModel;
    }
    return models[0].id;
  }

  private async resolveAutoModel(provider: string): Promise<string> {
    // Special case for OpenRouter - use static provider config since models are entered manually
    if (provider === "openrouter") {
      const providerConfig = providers.find(p => p.id === provider);
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
          return this.getDefaultModelForProvider(provider, models);
        }
      } catch (error) {
        // Fall back to legacy implementation
      }
    }

    // Fall back to legacy implementation
    const models = await getProviderModels(provider, "");
    if (models.length === 0) {
      throw new Error(`No models found for provider ${provider}`);
    }

    const providerConfig = providers.find(p => p.id === provider);
    if (providerConfig?.defaultModel && models.includes(providerConfig.defaultModel)) {
      return providerConfig.defaultModel;
    }
    return models[0];
  }
}
