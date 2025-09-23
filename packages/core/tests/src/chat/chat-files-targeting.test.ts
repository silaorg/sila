import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, ChatAppData } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makePngDataUrl(): string {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=';
  return `data:image/png;base64,${base64}`;
}

describe('Chat file targeting (per-chat files path under CAS)', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-chat-files-targeting-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('saves attachments under chat tree files root when targeted with treeId only', async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Provide FileStore for CAS writes
    if (typeof (layer as any).getFileStoreProvider === 'function') {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, 'test-config');
    const chatData = new ChatAppData(space, chatTree);

    const message = await chatData.newMessage('user', 'Here is an image', undefined, [
      { id: 'att1', kind: 'image', name: 'pixel.png', mimeType: 'image/png', size: 68, dataUrl: makePngDataUrl() }
    ], { treeId: chatTree.getId() }); // no path provided -> defaults to 'files'

    const atts = (message as any).files;
    expect(atts).toHaveLength(1);
    const ref = atts[0];
    expect(ref.tree).toBe(chatTree.getId());

    // Verify vertex exists under chat tree 'files'
    const filesRoot = chatTree.tree.getVertexByPath('files');
    expect(filesRoot).toBeDefined();
    const fileVertex = chatTree.tree.getVertex(ref.vertex);
    expect(fileVertex).toBeDefined();
    expect(fileVertex!.parent?.id).toBe(filesRoot!.id);
  });

  it('saves attachments under chat tree nested path when targeted with treeId + path', async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Provide FileStore for CAS writes
    if (typeof (layer as any).getFileStoreProvider === 'function') {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, 'test-config');
    const chatData = new ChatAppData(space, chatTree);

    const message = await chatData.newMessage('user', 'Nested path image', undefined, [
      { id: 'att1', kind: 'image', name: 'nested.png', mimeType: 'image/png', size: 68, dataUrl: makePngDataUrl() }
    ], { treeId: chatTree.getId(), path: 'files/screenshots' });

    const atts = (message as any).files;
    expect(atts).toHaveLength(1);
    const ref = atts[0];
    expect(ref.tree).toBe(chatTree.getId());

    // Verify nested folders exist and contain the file vertex
    const screenshotsFolder = chatTree.tree.getVertexByPath('files')?.children.find(c => c.getProperty('_n') === 'screenshots');
    expect(screenshotsFolder).toBeDefined();
    const fileVertex = chatTree.tree.getVertex(ref.vertex);
    expect(fileVertex).toBeDefined();
    expect(fileVertex!.parent?.id).toBe(screenshotsFolder!.id);
  });
});

