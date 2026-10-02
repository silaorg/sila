import { Lang } from 'aiwrapper';
import type { CustomProviderConfig } from '../models';
import { providers } from '../providers';

export async function getProviderModels(
  provider: string,
  keyOrConfig: string | CustomProviderConfig,
  signal?: AbortSignal,
): Promise<string[]> {
  if (provider.startsWith('custom-')) {
    if (typeof keyOrConfig === 'string') return keyOrConfig ? [keyOrConfig] : [];
    if (keyOrConfig.modelId) return [keyOrConfig.modelId];
    return getOpenAIModels(keyOrConfig.baseApiUrl, keyOrConfig.apiKey, signal);
  }

  if (provider !== 'ollama') {
    const ids = Lang.models.fromProvider(provider).map(model => model.id);
    const defaultModel = providers.find(p => p.id === provider)?.defaultModel;
    // A verified default can be newer than the pinned catalog.
    if (defaultModel && !ids.includes(defaultModel)) ids.unshift(defaultModel);
    if (ids.length) return ids;
  }

  const key = typeof keyOrConfig === 'string' ? keyOrConfig : keyOrConfig.apiKey;
  switch (provider) {
    case 'openai':
      return (await getOpenAIModels('https://api.openai.com/v1', key, signal))
        .filter(model => model.startsWith('gpt') || model.startsWith('o'));
    case 'groq':
      return getOpenAIModels('https://api.groq.com/openai/v1', key, signal);
    case 'kimi':
      return getOpenAIModels('https://api.moonshot.ai/v1', key, signal);
    case 'deepseek':
      return getOpenAIModels('https://api.deepseek.com/v1', key, signal);
    case 'anthropic':
      return fetchModelIds('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        signal,
      });
    case 'ollama':
      try {
        const response = await fetch('http://localhost:11434/api/tags', { signal });
        if (!response.ok) return [];
        const data = await response.json();
        return data.models.map((model: { name: string }) => model.name);
      } catch (error) {
        if (!signal?.aborted) console.warn('Unable to list Ollama models:', error);
        return [];
      }
    case 'openrouter':
    case 'google':
    case 'exa':
    case 'falai':
      return [];
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function getOpenAIModels(baseUrl: string, key: string, signal?: AbortSignal): Promise<string[]> {
  return fetchModelIds(`${baseUrl.replace(/\/$/, '')}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    signal,
  });
}

async function fetchModelIds(url: string, options: RequestInit): Promise<string[]> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data ?? []).map((model: { id: string }) => model.id);
  } catch (error) {
    if (!options.signal?.aborted) console.warn('Unable to list provider models:', error);
    return [];
  }
}
