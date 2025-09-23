import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, FileResolver, ChatAppData } from '@sila/core';
import type { AttachmentPreview } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makePngDataUrl(): string {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=';
  return `data:image/png;base64,${base64}`;
}

describe('Chat attachments via ChatAppData.newMessage', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-chat-attachments-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('persists image and text attachments via AttachmentPreview and resolves them', async () => {
    const fs = new NodeFileSystem();

    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    space.name = 'Chat Attachments Test Space';

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Connect file store to space (desktop CAS)
    space.setFileStoreProvider({
      getSpaceRootPath: () => tempDir,
      getFs: () => fs,
    });

    // Give time to ensure base structure exists
    await wait(300);

    // Create chat tree
    const appTree = ChatAppData.createNewChatTree(space, 'test-config');
    const chatData = new ChatAppData(space, appTree);

    // Build UI-like attachments
    const imageAttachment: AttachmentPreview = {
      id: 'img1',
      kind: 'image',
      name: 'pixel.png',
      mimeType: 'image/png',
      size: 68,
      dataUrl: makePngDataUrl(),
    };

    const textContent = 'Hello from attachment\nLine 2';
    const textAttachment: AttachmentPreview = {
      id: 'txt1',
      kind: 'text',
      name: 'hello.txt',
      mimeType: 'text/plain',
      size: textContent.length,
      content: textContent,
      metadata: { language: 'Plain Text', lineCount: 2, charCount: textContent.length, wordCount: 4 },
      width: 2,
      height: textContent.length,
      alt: 'Plain Text',
    };

    // Create a message with attachments using ChatAppData.newMessage
    const msg = await chatData.newMessage('user', 'Message with attachments', undefined, [imageAttachment, textAttachment]);

    // Message should persist only bare FileReference[]
    const refs = (msg as any).files as Array<{ tree: string; vertex: string }>;
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBe(2);
    expect(refs[0].tree).toBeDefined();
    expect(refs[0].vertex).toBeDefined();

    // Resolve for UI/AI consumption
    const resolver = new FileResolver(space);
    const resolved = await resolver.getFileData(refs as any);

    // Should resolve to one image and one text with dataUrl
    const images = resolved.filter((a) => a.kind === 'image' && typeof a.dataUrl === 'string');
    const texts = resolved.filter((a) => a.kind === 'text' && typeof a.dataUrl === 'string');

    expect(images.length).toBe(1);
    expect(texts.length).toBe(1);

    // Basic sanity checks
    expect(images[0]!.name).toBe('pixel.png');
    expect(images[0]!.mimeType).toBe('image/png');
    expect(images[0]!.dataUrl!.startsWith('data:image/png')).toBe(true);

    expect(texts[0]!.name).toBe('hello.txt');
    expect(texts[0]!.mimeType).toBe('text/plain');
    expect(texts[0]!.dataUrl!.startsWith('data:text/plain')).toBe(true);
  });

  it('allows sending messages with only attachments (no text)', async () => {
    const fs = new NodeFileSystem();

    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    space.name = 'Chat Attachments Only Test Space';

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Connect file store to space (desktop CAS)
    space.setFileStoreProvider({
      getSpaceRootPath: () => tempDir,
      getFs: () => fs,
    });

    // Give time to ensure base structure exists
    await wait(300);

    // Create chat tree
    const appTree = ChatAppData.createNewChatTree(space, 'test-config');
    const chatData = new ChatAppData(space, appTree);

    // Build UI-like attachment
    const imageAttachment: AttachmentPreview = {
      id: 'img1',
      kind: 'image',
      name: 'pixel.png',
      mimeType: 'image/png',
      size: 68,
      dataUrl: makePngDataUrl(),
    };

    // Create a message with only attachments (empty text)
    const msg = await chatData.newMessage('user', '', undefined, [imageAttachment]);

    // Message should persist only bare FileReference[]
    const refs = (msg as any).files as Array<{ tree: string; vertex: string }>;
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBe(1);
    expect(refs[0].tree).toBeDefined();
    expect(refs[0].vertex).toBeDefined();

    // Resolve for UI/AI consumption
    const resolver = new FileResolver(space);
    const resolved = await resolver.getFileData(refs as any);

    // Should resolve to one image with dataUrl
    const images = resolved.filter((a) => a.kind === 'image' && typeof a.dataUrl === 'string');
    expect(images.length).toBe(1);

    // Basic sanity checks
    expect(images[0]!.name).toBe('pixel.png');
    expect(images[0]!.mimeType).toBe('image/png');
    expect(images[0]!.dataUrl!.startsWith('data:image/png')).toBe(true);

    // Verify the message text is empty
    expect(msg.text).toBe('');
  });

  it('observes messages with only attachments (no text)', async () => {
    const fs = new NodeFileSystem();

    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    space.name = 'Chat Attachments Observation Test Space';

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Connect file store to space (desktop CAS)
    space.setFileStoreProvider({
      getSpaceRootPath: () => tempDir,
      getFs: () => fs,
    });

    // Give time to ensure base structure exists
    await wait(300);

    // Create chat tree
    const appTree = ChatAppData.createNewChatTree(space, 'test-config');
    const chatData = new ChatAppData(space, appTree);

    // Build UI-like attachment
    const imageAttachment: AttachmentPreview = {
      id: 'img1',
      kind: 'image',
      name: 'pixel.png',
      mimeType: 'image/png',
      size: 68,
      dataUrl: makePngDataUrl(),
    };

    // Set up observation before creating the message
    let observedVertices: any[] = [];
    const unsubscribe = chatData.observeNewMessages((vertices) => {
      observedVertices = vertices;
    });

    // Create a message with only attachments (empty text)
    const msg = await chatData.newMessage('user', '', undefined, [imageAttachment]);

    // Wait a bit for the observation to trigger
    await wait(100);

    // Verify that the message was observed
    expect(observedVertices.length).toBe(1);
    const observedVertex = observedVertices[0];
    expect(observedVertex.id).toBe(msg.id);
    expect(observedVertex.getProperty('text')).toBe('');
    expect(observedVertex.getProperty('files')).toBeDefined();
    expect(Array.isArray(observedVertex.getProperty('files'))).toBe(true);
    expect(observedVertex.getProperty('files').length).toBe(1);

    unsubscribe();
  });
});


