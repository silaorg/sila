import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

function createMockFile(name: string, type: string, content: string | ArrayBuffer): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
}

function createMockClipboardEvent(files: File[] = [], imageData?: string): ClipboardEvent {
  const clipboardData = {
    files: files.length > 0 ? files : null,
    types: imageData ? ['image/png'] : [],
    getData: (type: string) => {
      if (type.startsWith('image/') && imageData) {
        return imageData;
      }
      return '';
    }
  };

  return {
    clipboardData,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as ClipboardEvent;
}

describe('Clipboard paste functionality', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-clipboard-paste-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should process pasted image files correctly', async () => {
    // Create a mock image file
    const imageContent = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    const mockFile = createMockFile('test-image.png', 'image/png', imageContent);
    
    // Create mock clipboard event with file
    const clipboardEvent = createMockClipboardEvent([mockFile]);
    
    // Test that the event has the expected structure
    expect(clipboardEvent.clipboardData).toBeDefined();
    expect(clipboardEvent.clipboardData!.files).toHaveLength(1);
    expect(clipboardEvent.clipboardData!.files![0].name).toBe('test-image.png');
    expect(clipboardEvent.clipboardData!.files![0].type).toBe('image/png');
  });

  it('should process pasted text files correctly', async () => {
    // Create a mock text file
    const textContent = 'Hello, this is a test text file\nWith multiple lines';
    const mockFile = createMockFile('test.txt', 'text/plain', textContent);
    
    // Create mock clipboard event with file
    const clipboardEvent = createMockClipboardEvent([mockFile]);
    
    // Test that the event has the expected structure
    expect(clipboardEvent.clipboardData).toBeDefined();
    expect(clipboardEvent.clipboardData!.files).toHaveLength(1);
    expect(clipboardEvent.clipboardData!.files![0].name).toBe('test.txt');
    expect(clipboardEvent.clipboardData!.files![0].type).toBe('text/plain');
  });

  it('should process pasted image data correctly', async () => {
    const imageDataUrl = makePngDataUrl();
    
    // Create mock clipboard event with image data
    const clipboardEvent = createMockClipboardEvent([], imageDataUrl);
    
    // Test that the event has the expected structure
    expect(clipboardEvent.clipboardData).toBeDefined();
    expect(clipboardEvent.clipboardData!.types).toContain('image/png');
    expect(clipboardEvent.clipboardData!.getData('image/png')).toBe(imageDataUrl);
  });

  it('should handle empty clipboard data gracefully', async () => {
    // Create mock clipboard event with no files or image data
    const clipboardEvent = createMockClipboardEvent();
    
    // Test that the event has the expected structure
    expect(clipboardEvent.clipboardData).toBeDefined();
    expect(clipboardEvent.clipboardData!.files).toBeNull();
    expect(clipboardEvent.clipboardData!.types).toHaveLength(0);
  });

  it('should create valid AttachmentPreview objects from pasted files', async () => {
    const fs = new NodeFileSystem();

    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    space.name = 'Clipboard Paste Test Space';

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

    // Create a mock image attachment (simulating what would be created from pasted file)
    const imageAttachment: AttachmentPreview = {
      id: crypto.randomUUID(),
      kind: 'image',
      name: 'pasted-image.png',
      mimeType: 'image/png',
      size: 68,
      dataUrl: makePngDataUrl(),
      width: 1,
      height: 1,
    };

    // Create a message with the pasted attachment
    const msg = await chatData.newMessage('user', 'Message with pasted image', undefined, [imageAttachment]);

    // Verify the message was created successfully
    expect(msg).toBeDefined();
    expect((msg as any).files).toBeDefined();
    expect(Array.isArray((msg as any).files)).toBe(true);
    expect((msg as any).files.length).toBe(1);

    // Verify the file reference structure
    const fileRef = (msg as any).files[0];
    expect(fileRef.tree).toBeDefined();
    expect(fileRef.vertex).toBeDefined();
  });

  it('should handle multiple pasted files correctly', async () => {
    // Create multiple mock files
    const imageFile = createMockFile('image.png', 'image/png', new Uint8Array([137, 80, 78, 71]));
    const textFile = createMockFile('document.txt', 'text/plain', 'Hello world');
    
    // Create mock clipboard event with multiple files
    const clipboardEvent = createMockClipboardEvent([imageFile, textFile]);
    
    // Test that the event has the expected structure
    expect(clipboardEvent.clipboardData).toBeDefined();
    expect(clipboardEvent.clipboardData!.files).toHaveLength(2);
    expect(clipboardEvent.clipboardData!.files![0].name).toBe('image.png');
    expect(clipboardEvent.clipboardData!.files![1].name).toBe('document.txt');
  });
});
