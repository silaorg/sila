import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, ChatAppData, Backend, FilesTreeData } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('OpenRouter AI Integration', () => {
  let tempDir: string;
  let openrouterApiKey: string | undefined;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-openrouter-test-'));
    
    // Try to read OpenRouter API key from environment or .env file
    openrouterApiKey = process.env.OPENROUTER_API_KEY;
    
    if (!openrouterApiKey) {
      try {
        const envPath = path.join(process.cwd(), '.env');
        const envContent = await readFile(envPath, 'utf-8');
        const match = envContent.match(/OPENROUTER_API_KEY=([^\n]+)/);
        openrouterApiKey = match?.[1];
      } catch (error) {
        console.warn('No .env file found or could not read OpenRouter API key');
      }
    }
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should work with OpenRouter using auto model selection', async () => {
    // Skip test if no OpenRouter API key is available
    if (!openrouterApiKey || openrouterApiKey === 'your_openrouter_api_key_here') {
      console.log('Skipping test: No valid OpenRouter API key available');
      console.log('To run this test, set OPENROUTER_API_KEY environment variable or create a .env file with:');
      console.log('OPENROUTER_API_KEY=your_actual_openrouter_api_key');
      return;
    }

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
      apiKey: openrouterApiKey
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

  it('should work with OpenRouter using specific model (openai/gpt-4o)', async () => {
    // Skip test if no OpenRouter API key is available
    if (!openrouterApiKey || openrouterApiKey === 'your_openrouter_api_key_here') {
      console.log('Skipping test: No valid OpenRouter API key available');
      return;
    }

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
      apiKey: openrouterApiKey
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

  it('should work with OpenRouter using different models (anthropic/claude-3-5-sonnet)', async () => {
    // Skip test if no OpenRouter API key is available
    if (!openrouterApiKey || openrouterApiKey === 'your_openrouter_api_key_here') {
      console.log('Skipping test: No valid OpenRouter API key available');
      return;
    }

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
      apiKey: openrouterApiKey
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
    // Skip test if no OpenRouter API key is available
    if (!openrouterApiKey || openrouterApiKey === 'your_openrouter_api_key_here') {
      console.log('Skipping test: No valid OpenRouter API key available');
      return;
    }

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
      apiKey: openrouterApiKey
    });

    // Test the AgentServices directly to verify auto model resolution
    const { AgentServices } = await import('@sila/core');
    const agentServices = new AgentServices(space);

    // Test getMostCapableModel with OpenRouter
    const mostCapableModel = await agentServices.getMostCapableModel();
    
    expect(mostCapableModel).not.toBeNull();
    expect(mostCapableModel?.provider).toBe('openrouter');
    expect(mostCapableModel?.model).toBe('openai/gpt-4o'); // Should use the default model

    console.log('Most capable model resolved to:', mostCapableModel);

    // Test lang() method with "auto"
    const langProvider = await agentServices.lang('auto');
    expect(langProvider).toBeDefined();

    const lastResolved = agentServices.getLastResolvedModel();
    expect(lastResolved).not.toBeNull();
    expect(lastResolved?.provider).toBe('openrouter');
    expect(lastResolved?.model).toBe('openai/gpt-4o');

    console.log('Last resolved model:', lastResolved);
  }, 10000);

  it('should handle OpenRouter provider/auto model resolution', async () => {
    // Skip test if no OpenRouter API key is available
    if (!openrouterApiKey || openrouterApiKey === 'your_openrouter_api_key_here') {
      console.log('Skipping test: No valid OpenRouter API key available');
      return;
    }

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
      apiKey: openrouterApiKey
    });

    // Test the AgentServices directly to verify openrouter/auto resolution
    const { AgentServices } = await import('@sila/core');
    const agentServices = new AgentServices(space);

    // Test lang() method with "openrouter/auto"
    const langProvider = await agentServices.lang('openrouter/auto');
    expect(langProvider).toBeDefined();

    const lastResolved = agentServices.getLastResolvedModel();
    expect(lastResolved).not.toBeNull();
    expect(lastResolved?.provider).toBe('openrouter');
    expect(lastResolved?.model).toBe('openai/gpt-4o'); // Should use the default model

    console.log('OpenRouter/auto resolved to:', lastResolved);
  }, 10000);

  it('demonstrates test structure without API key', async () => {
    // This test demonstrates the structure without requiring an API key
    console.log('OpenRouter Test Structure Demonstration:');
    console.log('1. Create space with file store');
    console.log('2. Add OpenRouter provider with API key');
    console.log('3. Create chat assistant config with auto or specific model');
    console.log('4. Create chat tree and add user message');
    console.log('5. Set up backend to process messages');
    console.log('6. Wait for AI response and verify');
    console.log('');
    console.log('To run the actual tests:');
    console.log('1. Set OPENROUTER_API_KEY environment variable');
    console.log('2. Or create a .env file with: OPENROUTER_API_KEY=your_actual_openrouter_api_key');
    console.log('3. Run: npm -w packages/core run test -- --run src/ai/ai-openrouter.test.ts');
    console.log('');
    console.log('Available OpenRouter models to test:');
    console.log('- openai/gpt-4o (default)');
    console.log('- anthropic/claude-3-5-sonnet-20241022');
    console.log('- meta-llama/llama-3.2-90b-vision-instruct');
    console.log('- google/gemini-2.0-flash');
    
    // This test always passes - it's just for documentation
    expect(true).toBe(true);
  });
});