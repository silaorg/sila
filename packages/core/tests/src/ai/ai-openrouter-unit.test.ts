import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';

describe('OpenRouter Auto Model Resolution (Unit Tests)', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-openrouter-unit-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should resolve auto model to OpenRouter default when OpenRouter is configured', async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    // Set up file store
    space.setFileStoreProvider({
      getSpaceRootPath: () => tempDir,
      getFs: () => fs
    });

    // Set up persistence
    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager({ disableBackend: true });
    await manager.addNewSpace(space, [layer]);

    // Add OpenRouter provider (without API key for unit test)
    space.saveModelProviderConfig({
      id: 'openrouter',
      type: 'cloud',
      apiKey: 'test-key' // Dummy key for unit test
    });

    // Import and test AgentServices
    const { AgentServices } = await import('@sila/core');
    const { providers } = await import('@sila/core');
    const openrouterDefault = providers.find(p => p.id === 'openrouter')?.defaultModel;
    expect(openrouterDefault).toBeTruthy();
    const agentServices = new AgentServices(space);

    // Test getMostCapableModel with OpenRouter
    const mostCapableModel = await agentServices.getMostCapableModel();
    
    expect(mostCapableModel).not.toBeNull();
    expect(mostCapableModel?.provider).toBe('openrouter');
    expect(mostCapableModel?.model).toBe(openrouterDefault); // Should use the default model

    console.log('✅ Auto model resolution works:', mostCapableModel);
  });

  it('should resolve openrouter/auto to OpenRouter default model', async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    // Set up file store
    space.setFileStoreProvider({
      getSpaceRootPath: () => tempDir,
      getFs: () => fs
    });

    // Set up persistence
    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager({ disableBackend: true });
    await manager.addNewSpace(space, [layer]);

    // Add OpenRouter provider
    space.saveModelProviderConfig({
      id: 'openrouter',
      type: 'cloud',
      apiKey: 'test-key'
    });

    const { AgentServices } = await import('@sila/core');
    const { providers } = await import('@sila/core');
    const openrouterDefault = providers.find(p => p.id === 'openrouter')?.defaultModel;
    expect(openrouterDefault).toBeTruthy();
    const agentServices = new AgentServices(space);

    // Test resolveAutoModel directly
    const resolvedModel = await agentServices['resolveAutoModel']('openrouter');
    
    expect(resolvedModel).toBe(openrouterDefault);

    console.log('✅ OpenRouter/auto resolution works:', resolvedModel);
  });

  it('should prioritize OpenAI when multiple providers are configured', async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    // Set up file store
    space.setFileStoreProvider({
      getSpaceRootPath: () => tempDir,
      getFs: () => fs
    });

    // Set up persistence
    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager({ disableBackend: true });
    await manager.addNewSpace(space, [layer]);

    // Add multiple providers (current priority order favors OpenAI over OpenRouter)
    space.saveModelProviderConfig({
      id: 'openai',
      type: 'cloud',
      apiKey: 'test-openai-key'
    });

    space.saveModelProviderConfig({
      id: 'openrouter',
      type: 'cloud',
      apiKey: 'test-openrouter-key'
    });

    space.saveModelProviderConfig({
      id: 'anthropic',
      type: 'cloud',
      apiKey: 'test-anthropic-key'
    });

    const { AgentServices } = await import('@sila/core');
    const agentServices = new AgentServices(space);

    // Test getMostCapableModel - should prioritize OpenRouter
    const mostCapableModel = await agentServices.getMostCapableModel();
    
    expect(mostCapableModel).not.toBeNull();
    expect(mostCapableModel?.provider).toBe('openai');

    console.log('✅ Provider prioritization works:', mostCapableModel);
  });

  it('should handle OpenRouter provider config correctly', async () => {
    // Test that the provider config is correct
    const { providers } = await import('@sila/core');
    
    const openrouterProvider = providers.find(p => p.id === 'openrouter');
    
    expect(openrouterProvider).toBeDefined();
    expect(openrouterProvider?.id).toBe('openrouter');
    expect(openrouterProvider?.name).toBe('OpenRouter');
    expect(typeof openrouterProvider?.defaultModel).toBe('string');
    expect(openrouterProvider?.defaultModel).toBeTruthy();
    expect(openrouterProvider?.access).toBe('cloud');

    console.log('✅ OpenRouter provider config is correct:', openrouterProvider);
  });

});