import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, createFileStore, FilesTreeData } from '@sila/core';
import { NodeFileSystem } from './node-file-system';
import type { FileReference } from '@sila/core/spaces/files/FileResolver';

// Core file resolver that works without Svelte
class CoreFileResolver {
  constructor(private space: Space) {}

  async resolveFileReference(fileRef: FileReference) {
    try {
      const filesTree = await this.space.loadAppTree(fileRef.tree);
      if (!filesTree) {
        console.warn(`Files tree not found: ${fileRef.tree}`);
        return null;
      }

      const fileVertex = filesTree.tree.getVertex(fileRef.vertex);
      if (!fileVertex) {
        console.warn(`File vertex not found: ${fileRef.vertex}`);
        return null;
      }

      const hash = fileVertex.getProperty('hash') as string;
      const name = fileVertex.getProperty('name') as string;
      const mimeType = fileVertex.getProperty('mimeType') as string;
      const size = fileVertex.getProperty('size') as number;
      const width = fileVertex.getProperty('width') as number;
      const height = fileVertex.getProperty('height') as number;

      if (!hash) {
        console.warn(`File vertex missing hash: ${fileRef.vertex}`);
        return null;
      }

      const fileStore = this.space.getFileStore();
      if (!fileStore) {
        console.warn('FileStore not available for resolving file references');
        return null;
      }

      const bytes = await fileStore.getBytes(hash);
      const base64 = Buffer.from(bytes).toString('base64');
      const dataUrl = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;

      return {
        id: fileRef.vertex,
        name: name || 'Unknown file',
        mimeType,
        size,
        width,
        height,
        dataUrl,
        hash,
      };
    } catch (error) {
      console.error('Failed to resolve file reference:', error);
      return null;
    }
  }

  async resolveFileReferences(fileRefs: FileReference[]) {
    const resolved = [];
    for (const fileRef of fileRefs) {
      const resolvedFile = await this.resolveFileReference(fileRef);
      if (resolvedFile) {
        resolved.push(resolvedFile);
      }
    }
    return resolved;
  }
}

// Simple attachment types for testing
interface SimpleAttachment {
  id: string;
  kind: 'image' | 'text' | 'video' | 'pdf' | 'file';
  file: FileReference;
  alt?: string;
}

interface LegacyAttachment {
  id: string;
  kind: string;
  name?: string;
  alt?: string;
  dataUrl?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  file?: FileReference;
  content?: string;
}

// Utility functions for testing
class FilePreviewUtils {
  static extractFileReferences(message: any): FileReference[] {
    const attachments = message?.attachments;
    if (!attachments || !Array.isArray(attachments)) {
      return [];
    }

    return attachments
      .filter((att: any) => att?.file?.tree && att?.file?.vertex)
      .map((att: any) => att.file);
  }

  static hasFileAttachments(message: any): boolean {
    const attachments = message?.attachments;
    if (!attachments || !Array.isArray(attachments)) {
      return false;
    }

    return attachments.some((att: any) => 
      att?.file?.tree && att?.file?.vertex
    );
  }

  static getFileAttachmentCount(message: any): number {
    const attachments = message?.attachments;
    if (!attachments || !Array.isArray(attachments)) {
      return 0;
    }

    return attachments.filter((att: any) => 
      att?.file?.tree && att?.file?.vertex
    ).length;
  }
}

describe('Simplified File Previews (Core)', () => {
  let tempDir: string;
  let spaceManager: SpaceManager;
  let testSpace: Space;
  let filesTree: any;
  let fileVertex: any;
  let fileRef: FileReference;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-simplified-previews-core-test-'));
    
    // Create space manager and test space
    spaceManager = new SpaceManager();
    testSpace = Space.newSpace(crypto.randomUUID());
    testSpace.name = 'Simplified File Previews Core Test Space';

    // Create file system persistence layer
    const fs = new NodeFileSystem();
    const layer = new FileSystemPersistenceLayer(tempDir, testSpace.getId(), fs);
    await spaceManager.addNewSpace(testSpace, [layer]);

    // Wait for persistence to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create files tree using the proper API
    filesTree = FilesTreeData.createNewFilesTree(testSpace);
    
    // Create file store
    const fileStore = createFileStore({
      getSpaceRootPath: () => tempDir,
      getFs: () => fs
    });

    // Create a test file in CAS
    const testImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=';
    const testImageBytes = Buffer.from(testImageData, 'base64');
    const put = await fileStore!.putBytes(testImageBytes, 'image/png');

    // Create file vertex using the proper API
    fileVertex = FilesTreeData.createOrLinkFile({
      filesTree,
      parentFolder: filesTree.tree.getVertexByPath('files')!,
      name: 'test-image.png',
      hash: put.hash,
      mimeType: 'image/png',
      size: put.size,
      width: 800,
      height: 600,
    });

    fileRef = {
      tree: filesTree.getId(),
      vertex: fileVertex.id,
    };
  });

  afterEach(async () => {
    // Clean up
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    await spaceManager.closeSpace(testSpace.getId());
  });

  describe('Simple Attachments', () => {
    it('should create simple attachments with file references', () => {
      const simpleAttachment: SimpleAttachment = {
        id: 'att1',
        kind: 'image',
        file: fileRef,
        alt: 'Test image',
      };

      expect(simpleAttachment.id).toBe('att1');
      expect(simpleAttachment.kind).toBe('image');
      expect(simpleAttachment.file.tree).toBe(filesTree.getId());
      expect(simpleAttachment.file.vertex).toBe(fileVertex.id);
      expect(simpleAttachment.alt).toBe('Test image');
    });

    it('should validate simple attachments correctly', () => {
      const validAttachment: SimpleAttachment = {
        id: 'att1',
        kind: 'image',
        file: fileRef,
      };

      const invalidAttachment = {
        id: 'att1',
        kind: 'image',
        // Missing file reference
      };

      expect(validAttachment.file?.tree).toBeTruthy();
      expect(validAttachment.file?.vertex).toBeTruthy();
      expect(invalidAttachment.file).toBeUndefined();
    });
  });

  describe('Utility Functions', () => {
    it('should extract file references from messages', () => {
      const message = {
        id: 'msg1',
        text: 'Hello',
        attachments: [
          {
            id: 'att1',
            kind: 'image',
            file: fileRef,
          },
          {
            id: 'att2',
            kind: 'text',
            file: { tree: 'other-tree', vertex: 'other-vertex' },
          },
        ],
      };

      const fileRefs = FilePreviewUtils.extractFileReferences(message);

      expect(fileRefs).toHaveLength(2);
      expect(fileRefs[0]).toEqual(fileRef);
      expect(fileRefs[1]).toEqual({ tree: 'other-tree', vertex: 'other-vertex' });
    });

    it('should check for file attachments in messages', () => {
      const messageWithFiles = {
        id: 'msg1',
        text: 'Hello',
        attachments: [
          {
            id: 'att1',
            kind: 'image',
            file: fileRef,
          },
        ],
      };

      const messageWithoutFiles = {
        id: 'msg2',
        text: 'Hello',
        attachments: [],
      };

      expect(FilePreviewUtils.hasFileAttachments(messageWithFiles)).toBe(true);
      expect(FilePreviewUtils.hasFileAttachments(messageWithoutFiles)).toBe(false);
    });

    it('should count file attachments in messages', () => {
      const message = {
        id: 'msg1',
        text: 'Hello',
        attachments: [
          {
            id: 'att1',
            kind: 'image',
            file: fileRef,
          },
          {
            id: 'att2',
            kind: 'text',
            file: { tree: 'other-tree', vertex: 'other-vertex' },
          },
          {
            id: 'att3',
            kind: 'text',
            content: 'Hello world',
            // No file reference
          },
        ],
      };

      const count = FilePreviewUtils.getFileAttachmentCount(message);

      expect(count).toBe(2);
    });
  });

  describe('Message Processing', () => {
    it('should process messages with simple attachments', () => {
      const message = {
        id: 'msg1',
        text: 'Hello',
        attachments: [
          {
            id: 'att1',
            kind: 'image',
            file: fileRef,
          },
        ],
      };

      const fileRefs = FilePreviewUtils.extractFileReferences(message);
      const hasFiles = FilePreviewUtils.hasFileAttachments(message);
      const count = FilePreviewUtils.getFileAttachmentCount(message);

      expect(fileRefs).toHaveLength(1);
      expect(fileRefs[0]).toEqual(fileRef);
      expect(hasFiles).toBe(true);
      expect(count).toBe(1);
    });

    it('should handle messages without file attachments', () => {
      const message = {
        id: 'msg2',
        text: 'Hello',
        attachments: [],
      };

      const fileRefs = FilePreviewUtils.extractFileReferences(message);
      const hasFiles = FilePreviewUtils.hasFileAttachments(message);
      const count = FilePreviewUtils.getFileAttachmentCount(message);

      expect(fileRefs).toHaveLength(0);
      expect(hasFiles).toBe(false);
      expect(count).toBe(0);
    });
  });

  describe('File Reference Resolution', () => {
    it('should resolve file references to file information', async () => {
      const fileResolver = new CoreFileResolver(testSpace);
      const fileInfo = await fileResolver.resolveFileReference(fileRef);

      expect(fileInfo).toBeDefined();
      expect(fileInfo?.id).toBe(fileVertex.id);
      expect(fileInfo?.name).toBe('test-image.png');
      expect(fileInfo?.mimeType).toBe('image/png');
      expect(fileInfo?.size).toBe(68); // Size of our test image
      expect(fileInfo?.width).toBe(800);
      expect(fileInfo?.height).toBe(600);
      expect(fileInfo?.hash).toBe(fileVertex.getProperty('hash'));
      expect(fileInfo?.dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle missing file references gracefully', async () => {
      const fileResolver = new CoreFileResolver(testSpace);
      const missingFileRef: FileReference = {
        tree: 'non-existent-tree',
        vertex: 'non-existent-vertex',
      };

      const fileInfo = await fileResolver.resolveFileReference(missingFileRef);
      expect(fileInfo).toBeNull();
    });

    it('should resolve multiple file references', async () => {
      const fileResolver = new CoreFileResolver(testSpace);
      const fileRefs = [fileRef, { tree: 'other-tree', vertex: 'other-vertex' }];
      const fileInfos = await fileResolver.resolveFileReferences(fileRefs);

      expect(fileInfos).toHaveLength(1); // Only the valid one should resolve
      expect(fileInfos[0]?.id).toBe(fileVertex.id);
    });
  });

  describe('End-to-End Workflow', () => {
    it('should handle complete file preview workflow', async () => {
      // 1. Create a message with simple attachments
      const message = {
        id: 'msg1',
        text: 'Here is an image',
        attachments: [
          {
            id: 'att1',
            kind: 'image',
            file: fileRef,
          },
        ],
      };

      // 2. Extract file references
      const fileRefs = FilePreviewUtils.extractFileReferences(message);
      expect(fileRefs).toHaveLength(1);
      expect(fileRefs[0]).toEqual(fileRef);

      // 3. Resolve file references for preview
      const fileResolver = new CoreFileResolver(testSpace);
      const fileInfos = await fileResolver.resolveFileReferences(fileRefs);
      expect(fileInfos).toHaveLength(1);
      expect(fileInfos[0]?.name).toBe('test-image.png');
      expect(fileInfos[0]?.dataUrl).toMatch(/^data:image\/png;base64,/);

      // 4. Verify the complete workflow works
      expect(fileInfos[0]?.id).toBe(fileVertex.id);
      expect(fileInfos[0]?.mimeType).toBe('image/png');
      expect(fileInfos[0]?.width).toBe(800);
      expect(fileInfos[0]?.height).toBe(600);
    });
  });

  describe('Performance Benefits', () => {
    it('should demonstrate simple attachment efficiency', () => {
      const simpleMessage = {
        id: 'msg1',
        text: 'Here is an image',
        attachments: [
          {
            id: 'att1',
            kind: 'image',
            file: fileRef,
          },
        ],
      };

      const payload = JSON.stringify(simpleMessage.attachments);

      console.log(`Simple attachment payload size: ${payload.length} bytes`);
      console.log(`Payload structure: ${payload}`);

      expect(payload.length).toBeLessThan(200); // Should be very small
      expect(payload).toContain('"tree"');
      expect(payload).toContain('"vertex"');
    });
  });
});