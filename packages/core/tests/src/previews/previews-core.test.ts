import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, createFileStore, FilesTreeData, FileResolver } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import type { FileReference } from '@sila/core';

// Simple attachment types for testing
interface SimpleAttachment {
  id: string;
  kind: 'image' | 'text' | 'video' | 'pdf' | 'file';
  file: FileReference;
  alt?: string;
}

// Utility functions for testing
class FilePreviewUtils {
  static extractFileReferences(message: any): FileReference[] {
    const files = message?.files;
    if (!files || !Array.isArray(files)) {
      return [];
    }

    return files
      .filter((att: any) => att?.file?.tree && att?.file?.vertex)
      .map((att: any) => att.file);
  }

  static hasFileAttachments(message: any): boolean {
    const files = message?.files;
    if (!files || !Array.isArray(files)) {
      return false;
    }

    return files.some((att: any) => 
      att?.file?.tree && att?.file?.vertex
    );
  }

  static getFileAttachmentCount(message: any): number {
    const files = message?.files;
    if (!files || !Array.isArray(files)) {
      return 0;
    }

    return files.filter((att: any) => 
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
  let fileResolver: FileResolver;

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

    // Ensure the space has a FileStore provider
    if (typeof layer.getFileStoreProvider === 'function') {
      testSpace.setFileStoreProvider(layer.getFileStoreProvider());
    }

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
    fileVertex = FilesTreeData.saveFileInfo(
      filesTree.tree.getVertexByPath('files')!,
      {
        name: 'test-image.png',
        hash: put.hash,
        mimeType: 'image/png',
        size: put.size,
        width: 800,
        height: 600,
      }
    );

    fileRef = {
      tree: filesTree.getId(),
      vertex: fileVertex.id,
    };

    // Create framework-agnostic file resolver
    fileResolver = new FileResolver(testSpace);
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
        files: [
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
        files: [
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
        files: [],
      };

      expect(FilePreviewUtils.hasFileAttachments(messageWithFiles)).toBe(true);
      expect(FilePreviewUtils.hasFileAttachments(messageWithoutFiles)).toBe(false);
    });

    it('should count file attachments in messages', () => {
      const message = {
        id: 'msg1',
        text: 'Hello',
        files: [
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
        files: [
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
        files: [],
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
      const fileInfo = await fileResolver.resolveFileReference(fileRef);

      expect(fileInfo).toBeDefined();
      expect(fileInfo?.id).toBe(fileVertex.id);
      expect(fileInfo?.name).toBe('test-image.png');
      expect(fileInfo?.mimeType).toBe('image/png');
      expect(fileInfo?.size).toBe(68); // Size of our test image
      expect(fileInfo?.width).toBe(800);
      expect(fileInfo?.height).toBe(600);
      expect(fileInfo?.hash).toBe(fileVertex.getProperty('hash'));
      		expect(fileInfo?.url).toMatch(/^sila:\/\/spaces\/[^\/]+\/files\/[^\/]+/);
    });

    it('should handle missing file references gracefully', async () => {
      const missingFileRef: FileReference = {
        tree: 'non-existent-tree',
        vertex: 'non-existent-vertex',
      };

      const fileInfo = await fileResolver.resolveFileReference(missingFileRef);
      expect(fileInfo).toBeNull();
    });

    it('should resolve multiple file references', async () => {
      const fileRefs = [fileRef, { tree: 'other-tree', vertex: 'other-vertex' }];
      const fileInfos = await fileResolver.getFilesInfo(fileRefs);

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
        files: [
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
      const fileInfos = await fileResolver.getFilesInfo(fileRefs);
      expect(fileInfos).toHaveLength(1);
      expect(fileInfos[0]?.name).toBe('test-image.png');
      		expect(fileInfos[0]?.url).toMatch(/^sila:\/\/spaces\/[^\/]+\/files\/[^\/]+/);

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
        files: [
          {
            id: 'att1',
            kind: 'image',
            file: fileRef,
          },
        ],
      };

      const payload = JSON.stringify(simpleMessage.files);

      console.log(`Simple attachment payload size: ${payload.length} bytes`);
      console.log(`Payload structure: ${payload}`);

      expect(payload.length).toBeLessThan(200); // Should be very small
      expect(payload).toContain('"tree"');
      expect(payload).toContain('"vertex"');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null or undefined file references', () => {
      const messageWithNull = {
        id: 'msg1',
        text: 'Hello',
        files: [
          {
            id: 'att1',
            kind: 'image',
            file: null,
          },
        ],
      };

      const messageWithUndefined = {
        id: 'msg2',
        text: 'Hello',
        files: [
          {
            id: 'att1',
            kind: 'image',
            file: undefined,
          },
        ],
      };

      expect(FilePreviewUtils.extractFileReferences(messageWithNull)).toHaveLength(0);
      expect(FilePreviewUtils.extractFileReferences(messageWithUndefined)).toHaveLength(0);
      expect(FilePreviewUtils.hasFileAttachments(messageWithNull)).toBe(false);
      expect(FilePreviewUtils.hasFileAttachments(messageWithUndefined)).toBe(false);
    });

    it('should handle malformed file references', () => {
      const messageWithMalformedRefs = {
        id: 'msg1',
        text: 'Hello',
        files: [
          {
            id: 'att1',
            kind: 'image',
            file: { tree: 'valid-tree' }, // Missing vertex
          },
          {
            id: 'att2',
            kind: 'image',
            file: { vertex: 'valid-vertex' }, // Missing tree
          },
          {
            id: 'att3',
            kind: 'image',
            file: { tree: '', vertex: '' }, // Empty strings
          },
        ],
      };

      const fileRefs = FilePreviewUtils.extractFileReferences(messageWithMalformedRefs);
      expect(fileRefs).toHaveLength(0);
      expect(FilePreviewUtils.hasFileAttachments(messageWithMalformedRefs)).toBe(false);
    });

    it('should handle messages without attachments property', () => {
      const messageWithoutAttachments = {
        id: 'msg1',
        text: 'Hello',
      };

      const messageWithNullAttachments = {
        id: 'msg2',
        text: 'Hello',
        files: null,
      };

      const messageWithUndefinedAttachments = {
        id: 'msg3',
        text: 'Hello',
        files: undefined,
      };

      expect(FilePreviewUtils.extractFileReferences(messageWithoutAttachments)).toHaveLength(0);
      expect(FilePreviewUtils.extractFileReferences(messageWithNullAttachments)).toHaveLength(0);
      expect(FilePreviewUtils.extractFileReferences(messageWithUndefinedAttachments)).toHaveLength(0);
      expect(FilePreviewUtils.hasFileAttachments(messageWithoutAttachments)).toBe(false);
      expect(FilePreviewUtils.hasFileAttachments(messageWithNullAttachments)).toBe(false);
      expect(FilePreviewUtils.hasFileAttachments(messageWithUndefinedAttachments)).toBe(false);
    });

    it('should handle non-array attachments', () => {
      const messageWithStringAttachments = {
        id: 'msg1',
        text: 'Hello',
        files: 'not-an-array',
      };

      const messageWithObjectAttachments = {
        id: 'msg2',
        text: 'Hello',
        files: { some: 'object' },
      };

      expect(FilePreviewUtils.extractFileReferences(messageWithStringAttachments)).toHaveLength(0);
      expect(FilePreviewUtils.extractFileReferences(messageWithObjectAttachments)).toHaveLength(0);
      expect(FilePreviewUtils.hasFileAttachments(messageWithStringAttachments)).toBe(false);
      expect(FilePreviewUtils.hasFileAttachments(messageWithObjectAttachments)).toBe(false);
    });
  });

  describe('Different File Types', () => {
    it('should handle various file types in simple attachments', () => {
      const imageAttachment: SimpleAttachment = {
        id: 'img1',
        kind: 'image',
        file: fileRef,
        alt: 'Test image',
      };

      const textAttachment: SimpleAttachment = {
        id: 'txt1',
        kind: 'text',
        file: { tree: 'text-tree', vertex: 'text-vertex' },
      };

      const videoAttachment: SimpleAttachment = {
        id: 'vid1',
        kind: 'video',
        file: { tree: 'video-tree', vertex: 'video-vertex' },
      };

      const pdfAttachment: SimpleAttachment = {
        id: 'pdf1',
        kind: 'pdf',
        file: { tree: 'pdf-tree', vertex: 'pdf-vertex' },
      };

      const fileAttachment: SimpleAttachment = {
        id: 'file1',
        kind: 'file',
        file: { tree: 'file-tree', vertex: 'file-vertex' },
      };

      expect(imageAttachment.kind).toBe('image');
      expect(textAttachment.kind).toBe('text');
      expect(videoAttachment.kind).toBe('video');
      expect(pdfAttachment.kind).toBe('pdf');
      expect(fileAttachment.kind).toBe('file');

      // All should have valid file references
      expect(imageAttachment.file.tree).toBeTruthy();
      expect(textAttachment.file.tree).toBeTruthy();
      expect(videoAttachment.file.tree).toBeTruthy();
      expect(pdfAttachment.file.tree).toBeTruthy();
      expect(fileAttachment.file.tree).toBeTruthy();
    });

    it('should process mixed file types in messages', () => {
      const message = {
        id: 'msg1',
        text: 'Mixed file types',
        files: [
          {
            id: 'img1',
            kind: 'image',
            file: { tree: 'img-tree', vertex: 'img-vertex' },
          },
          {
            id: 'txt1',
            kind: 'text',
            file: { tree: 'txt-tree', vertex: 'txt-vertex' },
          },
          {
            id: 'vid1',
            kind: 'video',
            file: { tree: 'vid-tree', vertex: 'vid-vertex' },
          },
        ],
      };

      const fileRefs = FilePreviewUtils.extractFileReferences(message);
      expect(fileRefs).toHaveLength(3);
      expect(FilePreviewUtils.hasFileAttachments(message)).toBe(true);
      expect(FilePreviewUtils.getFileAttachmentCount(message)).toBe(3);
    });
  });

  describe('File Resolution Edge Cases', () => {
    it('should handle file store errors gracefully', async () => {
      // Create a file reference that exists in the tree but not in the file store
      const invalidFileVertex = filesTree.tree.newVertex(filesTree.tree.getVertexByPath('files')!.id, {
        _n: 'invalid-file.png',
        hash: 'non-existent-hash',
        name: 'invalid-file.png',
        mimeType: 'image/png',
        size: 0,
      });

      const invalidFileRef: FileReference = {
        tree: filesTree.getId(),
        vertex: invalidFileVertex.id,
      };

      const fileInfo = await fileResolver.resolveFileReference(invalidFileRef);
      // Since we no longer use file store, this should succeed and generate a URL
      expect(fileInfo).toBeDefined();
      expect(fileInfo?.url).toMatch(/^sila:\/\/spaces\/[^\/]+\/files\/non-existent-hash/);
      expect(fileInfo?.name).toBe('invalid-file.png');
    });

    it('should handle missing file properties gracefully', async () => {
      // Create a file vertex with missing properties
      const incompleteFileVertex = filesTree.tree.newVertex(filesTree.tree.getVertexByPath('files')!.id, {
        _n: 'incomplete-file.png',
        // Missing hash, mimeType, size, etc.
      });

      const incompleteFileRef: FileReference = {
        tree: filesTree.getId(),
        vertex: incompleteFileVertex.id,
      };

      const fileInfo = await fileResolver.resolveFileReference(incompleteFileRef);
      expect(fileInfo).toBeNull();
    });
  });
});