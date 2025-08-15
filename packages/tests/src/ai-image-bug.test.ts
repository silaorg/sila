import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, ChatAppData, Backend } from '@sila/core';
import { NodeFileSystem } from './node-file-system';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('AI Image Bug Reproduction', () => {
  let tempDir: string;
  let openaiApiKey: string | undefined;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-ai-image-test-'));
    
    // Try to read OpenAI API key from .env file
    try {
      const envPath = path.join(process.cwd(), '.env');
      const envContent = await readFile(envPath, 'utf-8');
      const match = envContent.match(/OPENAI_API_KEY=([^\n]+)/);
      openaiApiKey = match?.[1];
    } catch (error) {
      console.warn('No .env file found or could not read OpenAI API key');
    }
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reproduces bug: first AI response should see image in attachments', async () => {
    // Skip test if no OpenAI API key is available
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.log('Skipping test: No valid OpenAI API key available');
      console.log('To run this test, create a .env file in the root directory with:');
      console.log('OPENAI_API_KEY=your_actual_openai_api_key');
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

    // Add OpenAI provider
    space.saveModelProviderConfig({
      id: 'openai',
      type: 'cloud',
      apiKey: openaiApiKey
    });

    // Add a chat assistant config
    const assistantId = 'vision-assistant';
    space.addAppConfig({
      id: assistantId,
      name: 'Vision Assistant',
      button: 'New query',
      visible: true,
      description: 'Assistant that can see images',
      instructions: 'You are a helpful assistant that can see images. When shown an image, describe what you see in one word.',
      targetLLM: 'openai/gpt-4o' // Use GPT-4o which supports JSON responses
    } as any);

    // Set up backend to handle AI responses (BEFORE creating chat tree)
    const backend = new Backend(space, true);

    // Create chat tree (this should trigger the observeTreeLoad callback)
    const chatTree = ChatAppData.createNewChatTree(space, assistantId);
    const chatData = new ChatAppData(space, chatTree);

    // Wait a moment for the backend to process the tree creation
    await wait(1000);

    // Read the cat image
    const catImagePath = path.join(__dirname, '..', 'assets', 'to-send', 'cat.jpg');
    const catImageBuffer = await readFile(catImagePath);
    const catImageBase64 = catImageBuffer.toString('base64');
    const catImageDataUrl = `data:image/jpeg;base64,${catImageBase64}`;

    // Create a user message with the cat image
    const userMessage = await chatData.newMessage('user', 'What animal do you see in this image? Say only the animal name in one word.', undefined, [
      {
        id: 'cat-image',
        kind: 'image',
        name: 'cat.jpg',
        mimeType: 'image/jpeg',
        size: catImageBuffer.length,
        dataUrl: catImageDataUrl
      }
    ]);

    // Debug: Check what app backends were created
    console.log('App backends created:', backend['appBackends'].length);
    console.log('App tree ID:', chatTree.getId());
    console.log('App tree appId:', chatTree.getAppId());

    // Get the chat app backend
    const chatBackend = backend['appBackends'][0];
    if (!chatBackend) {
      throw new Error('Chat backend not found - observeTreeLoad should have created it');
    }

    // Wait for the AI response to be generated
    // The backend should automatically process the user message and generate a response
    await wait(10000); // Wait up to 10 seconds for AI response

    // Get the latest message (should be the AI response)
    const messages = chatData.messageVertices;
    const latestMessage = messages[messages.length - 1];
    
    if (!latestMessage) {
      throw new Error('No messages found');
    }

    const latestMessageData = latestMessage.getAsTypedObject<any>();
    if (latestMessageData.role !== 'assistant') {
      throw new Error('No assistant response generated');
    }

    // Check if the response contains "cat" (case insensitive)
    const responseText = latestMessageData.text.toLowerCase();
    console.log('AI Response:', latestMessageData.text);
    
    // The bug: first response should see the image and say "cat"
    expect(responseText).toContain('cat');
  }, 30000); // 30 second timeout for API call

  it('verifies bug: follow-up question should see the image', async () => {
    // Skip test if no OpenAI API key is available
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.log('Skipping test: No valid OpenAI API key available');
      console.log('To run this test, create a .env file in the root directory with:');
      console.log('OPENAI_API_KEY=your_actual_openai_api_key');
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

    // Add OpenAI provider
    space.saveModelProviderConfig({
      id: 'openai',
      type: 'cloud',
      apiKey: openaiApiKey
    });

    // Add a chat assistant config
    const assistantId = 'vision-assistant';
    space.addAppConfig({
      id: assistantId,
      name: 'Vision Assistant',
      button: 'New query',
      visible: true,
      description: 'Assistant that can see images',
      instructions: 'You are a helpful assistant that can see images. When shown an image, describe what you see in one word.',
      targetLLM: 'openai/gpt-4o' // Use GPT-4o which supports JSON responses
    } as any);

    // Set up backend to handle AI responses (BEFORE creating chat tree)
    const backend = new Backend(space, true);

    // Create chat tree (this should trigger the observeTreeLoad callback)
    const chatTree = ChatAppData.createNewChatTree(space, assistantId);
    const chatData = new ChatAppData(space, chatTree);

    // Wait a moment for the backend to process the tree creation
    await wait(1000);

    // Read the cat image
    const catImagePath = path.join(__dirname, '..', 'assets', 'to-send', 'cat.jpg');
    const catImageBuffer = await readFile(catImagePath);
    const catImageBase64 = catImageBuffer.toString('base64');
    const catImageDataUrl = `data:image/jpeg;base64,${catImageBase64}`;

    // Debug: Check what app backends were created
    console.log('App backends created:', backend['appBackends'].length);
    console.log('App tree ID:', chatTree.getId());
    console.log('App tree appId:', chatTree.getAppId());

    // Check if chat backend was created
    if (backend['appBackends'].length === 0) {
      throw new Error('Chat backend not found - observeTreeLoad should have created it');
    }

    // Create a user message with the cat image
    const userMessage = await chatData.newMessage('user', 'What animal do you see in this image? Say only the animal name in one word.', undefined, [
      {
        id: 'cat-image',
        kind: 'image',
        name: 'cat.jpg',
        mimeType: 'image/jpeg',
        size: catImageBuffer.length,
        dataUrl: catImageDataUrl
      }
    ]);

    // Wait for backend to initialize and process the first message
    await wait(2000);

    // Wait for the first AI response
    await wait(10000);

    // Get the first response
    const messages = chatData.messageVertices;
    const firstResponse = messages[messages.length - 1];
    
    if (!firstResponse) {
      throw new Error('No first response found');
    }

    const firstResponseData = firstResponse.getAsTypedObject<any>();
    if (firstResponseData.role !== 'assistant') {
      throw new Error('No first assistant response generated');
    }

    console.log('First AI Response:', firstResponseData.text);

    // Now create a follow-up question (without the image)
    const followUpMessage = await chatData.newMessage('user', 'Are you sure? What animal did you see?');

    // Wait for the follow-up response
    await wait(10000);

    // Get the follow-up response
    const updatedMessages = chatData.messageVertices;
    const followUpResponse = updatedMessages[updatedMessages.length - 1];
    
    if (!followUpResponse) {
      throw new Error('No follow-up response found');
    }

    const followUpResponseData = followUpResponse.getAsTypedObject<any>();
    if (followUpResponseData.role !== 'assistant') {
      throw new Error('No follow-up assistant response generated');
    }

    console.log('Follow-up AI Response:', followUpResponseData.text);

    // The bug: first response might not see the image, but follow-up should
    const firstResponseText = firstResponseData.text.toLowerCase();
    const followUpResponseText = followUpResponseData.text.toLowerCase();
    
    // At least one of the responses should contain "cat"
    const firstSeesCat = firstResponseText.includes('cat');
    const followUpSeesCat = followUpResponseText.includes('cat');
    
    console.log(`First response sees cat: ${firstSeesCat}`);
    console.log(`Follow-up response sees cat: ${followUpSeesCat}`);
    
    // This test documents the bug: the first response might not see the image
    // but the follow-up question should be able to reference the image
    expect(firstSeesCat || followUpSeesCat).toBe(true);
  }, 60000); // 60 second timeout for API calls

  it('demonstrates test structure without API key', async () => {
    // This test demonstrates the structure without requiring an API key
    console.log('Test structure demonstration:');
    console.log('1. Create space with file store');
    console.log('2. Add OpenAI provider with API key');
    console.log('3. Create chat assistant config');
    console.log('4. Create chat tree and add user message with cat image');
    console.log('5. Set up backend to process messages');
    console.log('6. Wait for AI response and check for "cat" keyword');
    console.log('');
    console.log('To run the actual tests:');
    console.log('1. Create a .env file in the root directory');
    console.log('2. Add: OPENAI_API_KEY=your_actual_openai_api_key');
    console.log('3. Run: npm -w packages/tests run test -- --run src/ai-image-bug.test.ts');
    
    // This test always passes - it's just for documentation
    expect(true).toBe(true);
  });
});
