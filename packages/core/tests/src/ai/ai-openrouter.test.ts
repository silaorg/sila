import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, ChatAppData, Backend } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { getEnvVar } from '../setup/env';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const openrouterApiKey = getEnvVar('OPENROUTER_API_KEY', 'your_openrouter_api_key_here');
const openrouterIntegrationTest = openrouterApiKey ? it : it.skip;

if (!openrouterApiKey) {
  console.warn(
    '[tests] Skipping OpenRouter integration tests: set OPENROUTER_API_KEY in your environment or .env file to enable them.'
  );
}

describe('OpenRouter AI Integration', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-openrouter-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  openrouterIntegrationTest('should work with OpenRouter using auto model selection', async () => {
    const apiKey = openrouterApiKey!;
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
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Add OpenRouter provider
    space.saveModelProviderConfig({
      id: 'openrouter',
      type: 'cloud',
      apiKey
    });

    // Add a chat assistant config using "auto" model
    const assistantId = 'openrouter-assistant';
    space.addAppConfig({
      id: assistantId,
      name: 'OpenRouter Assistant',
      button: 'New query',
      visible: true,
      description: 'Assistant using OpenRouter with auto model selection',
      instructions: 'You are a helpful assistant. Respond with exactly "Hello from OpenRouter!" to confirm you are working.',
      targetLLM: 'auto' // This should resolve to openai/gpt-4o
    } as any);

    // Set up backend to handle AI responses
    const backend = new Backend(space, true);

    // Create chat tree
    const chatTree = ChatAppData.createNewChatTree(space, assistantId);
    const chatData = new ChatAppData(space, chatTree);

    // Wait for backend to initialize
    await wait(1000);

    // Create a user message
    const userMessage = await chatData.newMessage({ role: 'user', text: 'Hello! Please respond with exactly "Hello from OpenRouter!"' });

    // Wait for AI response
    await wait(15000);

    // Get the response
    const messages = chatData.messageVertices;
    const response = messages[messages.length - 1];
    
    if (!response) {
      throw new Error('No response found');
    }

    const responseData = response.getAsTypedObject<any>();
    if (responseData.role !== 'assistant') {
      throw new Error('No assistant response generated');
    }

    console.log('OpenRouter AI Response:', responseData.text);
    
    // Should contain the expected response
    expect(responseData.text).toContain('Hello from OpenRouter!');
  }, 30000);

  openrouterIntegrationTest('should work with OpenRouter using specific model (openai/gpt-4o)', async () => {
    const apiKey = openrouterApiKey!;
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
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Add OpenRouter provider
    space.saveModelProviderConfig({
      id: 'openrouter',
      type: 'cloud',
      apiKey
    });

    // Add a chat assistant config using specific model
    const assistantId = 'openrouter-specific-model';
    space.addAppConfig({
      id: assistantId,
      name: 'OpenRouter Specific Model',
      button: 'New query',
      visible: true,
      description: 'Assistant using OpenRouter with specific model',
      instructions: 'You are a helpful assistant. Respond with exactly "Using GPT-4o via OpenRouter!" to confirm the specific model is working.',
      targetLLM: 'openrouter/openai/gpt-4o' // Specific model via OpenRouter
    } as any);

    // Set up backend
    const backend = new Backend(space, true);

    // Create chat tree
    const chatTree = ChatAppData.createNewChatTree(space, assistantId);
    const chatData = new ChatAppData(space, chatTree);

    // Wait for backend to initialize
    await wait(1000);

    // Create a user message
    const userMessage = await chatData.newMessage({ role: 'user', text: 'Hello! Please respond with exactly "Using GPT-4o via OpenRouter!"' });

    // Wait for AI response
    await wait(15000);

    // Get the response
    const messages = chatData.messageVertices;
    const response = messages[messages.length - 1];
    
    if (!response) {
      throw new Error('No response found');
    }

    const responseData = response.getAsTypedObject<any>();
    if (responseData.role !== 'assistant') {
      throw new Error('No assistant response generated');
    }

    console.log('OpenRouter Specific Model Response:', responseData.text);
    
    // Should contain the expected response
    expect(responseData.text).toContain('Using GPT-4o via OpenRouter!');
  }, 30000);

  openrouterIntegrationTest('should work with OpenRouter using different models (anthropic/claude-3-5-sonnet)', async () => {
    const apiKey = openrouterApiKey!;
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
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Add OpenRouter provider
    space.saveModelProviderConfig({
      id: 'openrouter',
      type: 'cloud',
      apiKey
    });

    // Add a chat assistant config using Claude model
    const assistantId = 'openrouter-claude';
    space.addAppConfig({
      id: assistantId,
      name: 'OpenRouter Claude',
      button: 'New query',
      visible: true,
      description: 'Assistant using OpenRouter with Claude model',
      instructions: 'You are a helpful assistant. Respond with exactly "Hello from Claude via OpenRouter!" to confirm the Claude model is working.',
      targetLLM: 'openrouter/anthropic/claude-3-5-sonnet-20241022' // Claude model via OpenRouter
    } as any);

    // Set up backend
    const backend = new Backend(space, true);

    // Create chat tree
    const chatTree = ChatAppData.createNewChatTree(space, assistantId);
    const chatData = new ChatAppData(space, chatTree);

    // Wait for backend to initialize
    await wait(1000);

    // Create a user message
    const userMessage = await chatData.newMessage({ role: 'user', text: 'Hello! Please respond with exactly "Hello from Claude via OpenRouter!"' });

    // Wait for AI response
    await wait(15000);

    // Get the response
    const messages = chatData.messageVertices;
    const response = messages[messages.length - 1];
    
    if (!response) {
      throw new Error('No response found');
    }

    const responseData = response.getAsTypedObject<any>();
    if (responseData.role !== 'assistant') {
      throw new Error('No assistant response generated');
    }

    console.log('OpenRouter Claude Response:', responseData.text);
    
    // Should contain the expected response
    expect(responseData.text).toContain('Hello from Claude via OpenRouter!');
  }, 30000);

  it('should handle OpenRouter auto model resolution correctly', async () => {
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
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Add OpenRouter provider
    space.saveModelProviderConfig({
      id: 'openrouter',
      type: 'cloud',
      apiKey: openrouterApiKey ?? 'test-openrouter-key'
    });

    // Test the AgentServices directly to verify auto model resolution
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

    console.log('Most capable model resolved to:', mostCapableModel);

    // Test lang() method with "auto"
    const langProvider = await agentServices.lang('auto');
    expect(langProvider).toBeDefined();

    const lastResolved = agentServices.getLastResolvedModel();
    expect(lastResolved).not.toBeNull();
    expect(lastResolved?.provider).toBe('openrouter');
    expect(lastResolved?.model).toBe(openrouterDefault);

    console.log('Last resolved model:', lastResolved);
  }, 10000);

  it('should handle OpenRouter provider/auto model resolution', async () => {
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
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Add OpenRouter provider
    space.saveModelProviderConfig({
      id: 'openrouter',
      type: 'cloud',
      apiKey: openrouterApiKey ?? 'test-openrouter-key'
    });

    // Test the AgentServices directly to verify openrouter/auto resolution
    const { AgentServices } = await import('@sila/core');
    const { providers } = await import('@sila/core');
    const openrouterDefault = providers.find(p => p.id === 'openrouter')?.defaultModel;
    expect(openrouterDefault).toBeTruthy();
    const agentServices = new AgentServices(space);

    // Test lang() method with "openrouter/auto"
    const langProvider = await agentServices.lang('openrouter/auto');
    expect(langProvider).toBeDefined();

    const lastResolved = agentServices.getLastResolvedModel();
    expect(lastResolved).not.toBeNull();
    expect(lastResolved?.provider).toBe('openrouter');
    expect(lastResolved?.model).toBe(openrouterDefault); // Should use the default model

    console.log('OpenRouter/auto resolved to:', lastResolved);
  }, 10000);
});