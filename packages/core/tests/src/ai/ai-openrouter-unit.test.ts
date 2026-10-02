import { describe, it, expect } from 'vitest';
import { AgentServices, Space, providers } from '@sila/core';

const defaultModel = providers.find(p => p.id === 'openrouter')!.defaultModel;

function createServices(providerIds: string[]): AgentServices {
  const space = Space.newSpace(crypto.randomUUID());
  for (const id of providerIds) {
    space.saveModelProviderConfig({ id, type: 'cloud', apiKey: 'test-key' });
  }
  return new AgentServices(space);
}

describe('OpenRouter model selection', () => {
  it('uses the configured default for Auto', async () => {
    const services = createServices(['openrouter']);
    expect(await services.getMostCapableModel()).toEqual({
      provider: 'openrouter', model: defaultModel,
    });
  });

  it('resolves openrouter/auto through the public provider API', async () => {
    const services = createServices(['openrouter']);
    await services.lang('openrouter/auto');
    expect(services.getLastResolvedModel()).toEqual({
      provider: 'openrouter', model: defaultModel,
    });
  });

  it('keeps explicitly selected OpenRouter models', async () => {
    const services = createServices(['openrouter']);
    await services.lang('openrouter/anthropic/claude-sonnet-5.5');
    expect(services.getLastResolvedModel()).toEqual({
      provider: 'openrouter', model: 'anthropic/claude-sonnet-5.5',
    });
  });

  it('preserves direct OpenAI priority when multiple providers are configured', async () => {
    const services = createServices(['openrouter', 'anthropic', 'openai']);
    expect((await services.getMostCapableModel())?.provider).toBe('openai');
  });
});
