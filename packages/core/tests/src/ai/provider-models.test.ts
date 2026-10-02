import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lang } from 'aiwrapper';
import { getProviderModels, providers } from '@sila/core';

const custom = {
  id: 'custom-test', type: 'cloud' as const, name: 'Test',
  apiKey: 'test-key', baseApiUrl: 'https://provider.example/v1/', modelId: '',
};

afterEach(() => vi.unstubAllGlobals());

describe('provider model lists', () => {
  it.each(['openai', 'anthropic', 'google', 'openrouter'])('includes the current %s default once', async provider => {
    const defaultModel = providers.find(p => p.id === provider)!.defaultModel;
    const ids = await getProviderModels(provider, '');
    expect(ids.filter(id => id === defaultModel)).toHaveLength(1);
    expect(ids).toEqual(expect.arrayContaining(Lang.models.fromProvider(provider).map(model => model.id)));
  });

  it('uses a custom model without making a network request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await getProviderModels(custom.id, { ...custom, modelId: 'my-model' })).toEqual(['my-model']);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches custom model IDs with credentials and cancellation', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: [{ id: 'my-model' }] }));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect(await getProviderModels(custom.id, custom, signal)).toEqual(['my-model']);
    expect(fetch).toHaveBeenCalledWith('https://provider.example/v1/models', {
      headers: { Authorization: 'Bearer test-key' }, signal,
    });
  });

  it('returns no models for a rejected API request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    expect(await getProviderModels(custom.id, custom)).toEqual([]);
  });
});
