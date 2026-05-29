import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, ChatAppData } from '@sila/core';
import type { AttachmentPreview } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makePngDataUrl(): string {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=';
  return `data:image/png;base64,${base64}`;
}

describe('Chat message editing with attachments', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-chat-edit-attachments-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('retains attachments when editing a message', async () => {
    const fs = new NodeFileSystem();

    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    space.name = 'Chat Edit Attachments Test Space';

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    space.setFileStoreProvider({
      getSpaceRootPath: () => tempDir,
      getFs: () => fs,
    });

    await wait(300);

    const appTree = ChatAppData.createNewChatTree(space, 'test-config');
    const chatData = new ChatAppData(space, appTree);

    const imageAttachment: AttachmentPreview = {
      id: 'img1',
      kind: 'image',
      name: 'pixel.png',
      mimeType: 'image/png',
      size: 68,
      dataUrl: makePngDataUrl(),
    };

    await chatData.newMessage({
        role: 'user',
        text: 'Original message',
        attachments: [imageAttachment]
    });

    const initialVertices = chatData.messageVertices;
    const msgVertex = initialVertices[initialVertices.length - 1];
    const msg = msgVertex.getAsTypedObject<any>();

    const refs = (msg as any).files as Array<{ tree: string; vertex: string }>;
    expect(refs.length).toBe(1);

    await chatData.editMessage(msgVertex.id, 'Edited message');

    const vertices = chatData.messageVertices;
    const lastVertex = vertices[vertices.length - 1];
    const editedMsg = lastVertex.getAsTypedObject<any>();

    expect(editedMsg.text).toBe('Edited message');
    expect(editedMsg.files).toBeDefined();
    expect(editedMsg.files.length).toBe(1);
    expect(editedMsg.files[0].vertex).toBe(refs[0].vertex);
  });
});
