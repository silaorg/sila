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

    const message = await chatData.newMessage({ 
      role: 'user', 
      text: 'Here is an image', 
      attachments: [
        { id: 'att1', kind: 'image', name: 'pixel.png', mimeType: 'image/png', size: 68, dataUrl: makePngDataUrl() }
      ],
      fileTarget: { treeId: chatTree.getId() }
    });

    const atts = (message as any).files;
    expect(atts).toHaveLength(1);
    const ref = atts[0];
    expect(ref.tree).toBe(chatTree.getId());

    // Verify vertex exists under chat tree assets root
    const assetsRoot = chatTree.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
    expect(assetsRoot).toBeDefined();
    const fileVertex = chatTree.tree.getVertex(ref.vertex);
    expect(fileVertex).toBeDefined();
    expect(fileVertex!.parent?.id).toBe(assetsRoot!.id);
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

    const message = await chatData.newMessage({ 
      role: 'user', 
      text: 'Nested path image', 
      attachments: [
        { id: 'att1', kind: 'image', name: 'nested.png', mimeType: 'image/png', size: 68, dataUrl: makePngDataUrl() }
      ],
      fileTarget: { treeId: chatTree.getId(), path: `${ChatAppData.ASSETS_ROOT_PATH}/screenshots` }
    });

    const atts = (message as any).files;
    expect(atts).toHaveLength(1);
    const ref = atts[0];
    expect(ref.tree).toBe(chatTree.getId());

    // Verify the file vertex exists under a nested folder inside the assets root
    const assetsRoot = chatTree.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
    expect(assetsRoot).toBeDefined();
    const fileVertex = chatTree.tree.getVertex(ref.vertex)!;
    expect(fileVertex).toBeDefined();
    // Parent should not be the assets root itself
    expect(fileVertex.parent?.id).not.toBe(assetsRoot!.id);
    // Parent should be a direct child of the assets root (i.e., a nested folder)
    expect(assetsRoot!.children.some(c => c.id === fileVertex.parent?.id)).toBe(true);
  });
});

