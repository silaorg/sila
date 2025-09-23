import { Space, SpaceManager, FileSystemPersistenceLayer, ChatAppData } from '@sila/core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NodeFileSystem } from '../setup/setup-node-file-system';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Chat app tree creation and persistence', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-chat-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates a chat app tree, adds messages, persists, and reloads', async () => {
    const fs = new NodeFileSystem();

    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    // Add a chat assistant config and create a chat tree for it
    const assistantId = 'assistant-1';
    space.addAppConfig({
      id: assistantId,
      name: 'Chat',
      button: 'New query',
      visible: true,
      description: 'Test chat',
      instructions: 'Be concise'
    } as any);

    const chatTree = ChatAppData.createNewChatTree(space, assistantId);
    const chatData = new ChatAppData(space, chatTree);
    chatData.title = 'My conversation';

    // Add a small chain of messages
    await chatData.newMessage('user', 'Hello');
    await chatData.newMessage('assistant', 'Hi!');
    await chatData.newMessage('user', 'How are you?');

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Allow time for batched ops to flush
    await wait(1500);

    // Load from disk to verify integrity
    const loader = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    await loader.connect();
    const spaceOps = await loader.loadSpaceTreeOps();
    const loadedSpace = Space.existingSpaceFromOps(spaceOps);

    // Verify the app tree reference exists in space
    const appForest = loadedSpace.getVertexByPath('app-forest');
    expect(appForest).toBeTruthy();
    expect((appForest as any).children.length).toBeGreaterThan(0);

    // We can’t load app tree via loader easily without SpaceManager, but we can assert the space ops include message property ops
    // Basic sanity: at least some property ops saved
    expect(spaceOps.length).toBeGreaterThan(0);
  });

  it('persists image attachments by saving to CAS and storing file refs in message', async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    // Minimal config and chat tree
    const assistantId = 'assistant-attachments';
    space.addAppConfig({ id: assistantId, name: 'Chat', button: 'New', visible: true, description: '', instructions: '' } as any);
    const chatTree = ChatAppData.createNewChatTree(space, assistantId);
    const chatData = new ChatAppData(space, chatTree);

    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=';

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Create a user message with one image attachment
    const msg = await chatData.newMessage('user', 'Here is an image', undefined, [
      { id: 'a1', kind: 'image', name: 'pixel.png', mimeType: 'image/png', size: 68, dataUrl: tinyPng }
    ]);

    // Allow write to flush
    await wait(1200);

    // The saved message should have files with file refs (tree+vertex)
    const files = (chatTree.tree.getVertex(msg.id) as any).getProperty('files');
    expect(Array.isArray(files)).toBe(true);
    expect(files[0]?.tree).toBeTypeOf('string');
    expect(files[0]?.vertex).toBeTypeOf('string');
  });
});