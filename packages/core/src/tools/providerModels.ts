import { Lang } from 'aiwrapper';
import type { CustomProviderConfig } from '../models';

export function getProviderModels(
  provider: string,
  key: string,
  signal?: AbortSignal,
): Promise<string[]> {
  console.log('Get models for ' + provider);

  if (provider === "mock") {
    return Promise.resolve(["mock-1"]);
  }
  
  // For cloud providers, try to use Lang.models if available
  if (provider !== "ollama") {
    try {
      const models = Lang.models.fromProvider(provider);

      console.log('Found models for ' + provider);
      console.log(models);
      
      if (models && models.length > 0) {
        return Promise.resolve(models.map(model => model.id));
      }
    } catch (error) {
      console.warn(`Error getting models from provider ${provider}:`, error);
      // Continue to fallback implementation
    }
  }
  
  // Custom provider (starts with custom-)
  if (provider.startsWith('custom-')) {
    // For custom providers, we check if we have the config object
    // @ts-ignore
    if (typeof key === 'object' && key !== null && 'baseApiUrl' in key) {
      const config = key as CustomProviderConfig;
      // If we have a model ID already set in the config, prioritize that
      if (config.modelId) {
        return Promise.resolve([config.modelId]); // Return the configured model ID
      }
      // Otherwise, try to fetch models from the API
      return getProviderModels_customOpenAI(config.baseApiUrl, config.apiKey, signal);
    }
    // If no config is provided but we have a key string, use default OpenAI-like endpoints
    else if (typeof key === 'string' && key) {
      return Promise.resolve([key]); // Just return the model ID from the config
    }
    // No key or config provided
    return Promise.resolve([]);
  }
  
  // Special case for OpenRouter - return empty array since models are entered manually
  if (provider === "openrouter") {
    return Promise.resolve([]);
  }
  
  if (provider === "exa") {
    return Promise.resolve([]);
  }
  
  // Legacy implementation as fallback
  switch (provider) {
    case "openai":
      return getProviderModels_openai(key, signal);
    case "groq":
      return getProviderModels_groq(key, signal);
    case "anthropic":
      return getProviderModels_anthropic(key, signal);
    case "ollama":
      return getProviderModels_ollama();
    case "deepseek":
      return getProviderModels_deepseek(key, signal);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function getProviderModels_openai(key: string, signal?: AbortSignal) {
  const models = getProviderModels_openaiLikeApi(
    "https://api.openai.com/v1",
    key,
    signal,
  );

  // Here we filter out models that don't have "gpt" in their id
  return models.then((models) =>
    models.filter((model) => model.startsWith("gpt") || model.startsWith("o"))
  );
}

function getProviderModels_groq(key: string, signal?: AbortSignal) {
  return getProviderModels_openaiLikeApi(
    "https://api.groq.com/openai/v1",
    key,
    signal,
  );
}

async function getProviderModels_openaiLikeApi(
  url: string,
  key: string,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    return await fetch(url + "/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal,
    }).then((res) => res.json())
      .then((data) => data.data.map((model: { id: string }) => model.id));
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("Fetch aborted");
    } else {
      console.error("Fetch error:", err);
    }

    return [];
  }
}

async function getProviderModels_anthropic(key: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      signal,
    });

    const data = await res.json();

    if (data.error || !data.data) {
      console.error("Anthropic error:", data);
      return [];
    }

    return data.data.map((model: { id: string }) => model.id);
  } catch (err: any) {
    console.error("Fetch error:", err);
    return [];
  }
}

async function getProviderModels_ollama(): Promise<string[]> {
  try {
    // @TODO: allow to use different addresses
    const response = await fetch("http://localhost:11434/api/tags");
    const data = await response.json();
    return data.models.map((model: { name: string }) => model.name);
  } catch (err: any) {
    console.error("Fetch error:", err);
    return [];
  }
}

async function getProviderModels_deepseek(key: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch("https://api.deepseek.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key}`,
      },
      signal,
    });

    const data = await res.json();

    if (!data.data) {
      console.error("DeepSeek error:", data);
      return [];
    }

    return data.data.map((model: { id: string }) => model.id);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("Fetch aborted");
    } else {
      console.error("Fetch error:", err);
    }
    return [];
  }
}

// For custom OpenAI-like providers
function getProviderModels_customOpenAI(
  baseUrl: string, 
  key: string, 
  signal?: AbortSignal
): Promise<string[]> {
  return getProviderModels_openaiLikeApi(baseUrl, key, signal);
}
