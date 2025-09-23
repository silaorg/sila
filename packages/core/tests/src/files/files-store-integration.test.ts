import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Space, FileSystemPersistenceLayer, SpaceManager } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('File Store Integration', () => {
  let space: Space;
  let tempDir: string;
  let fs: NodeFileSystem;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-file-store-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    fs = new NodeFileSystem();
    
    // Create a real space for testing
    space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    
    // Set up file store properly
    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);
  });

  afterEach(async () => {
    // Clean up
  });

  describe('Text File Storage', () => {
    it('should store text files in CAS correctly', async () => {
      // Get the file store
      const fileStore = space.getFileStore();
      expect(fileStore).toBeTruthy();

      // Create a simple text file
      const textContent = '8899';
      const textBlob = new Blob([textContent], { type: 'text/plain' });
      
      // Store the text file in CAS
      const put = await fileStore!.putBytes(new TextEncoder().encode(textContent), 'text/plain');
      expect(put).toBeDefined();
      expect(put.hash).toBeDefined();

      // Verify we can retrieve the content
      const retrievedData = await fileStore!.getBytes(put.hash);
      expect(retrievedData).toBeDefined();
      
      const retrievedText = new TextDecoder().decode(retrievedData);
      expect(retrievedText).toBe(textContent);
    });

    it('should store markdown files in CAS correctly', async () => {
      const fileStore = space.getFileStore();
      expect(fileStore).toBeTruthy();

      // Create a markdown file
      const markdownContent = `# Test File

This is a test markdown file.

## Number
The number is: **8899**`;

      const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });
      
      // Store the markdown file in CAS
      const put = await fileStore!.putBytes(new TextEncoder().encode(markdownContent), 'text/markdown');
      expect(put).toBeDefined();
      expect(put.hash).toBeDefined();

      // Verify we can retrieve the content
      const retrievedData = await fileStore!.getBytes(put.hash);
      expect(retrievedData).toBeDefined();
      
      const retrievedText = new TextDecoder().decode(retrievedData);
      expect(retrievedText).toBe(markdownContent);
    });

    it('should handle large text files', async () => {
      const fileStore = space.getFileStore();
      expect(fileStore).toBeTruthy();

      // Create a large text file
      const largeContent = 'Line 1\n'.repeat(1000); // 1000 lines
      const largeBlob = new Blob([largeContent], { type: 'text/plain' });
      
      // Store the large text file in CAS
      const put = await fileStore!.putBytes(new TextEncoder().encode(largeContent), 'text/plain');
      expect(put).toBeDefined();
      expect(put.hash).toBeDefined();

      // Verify we can retrieve the content
      const retrievedData = await fileStore!.getBytes(put.hash);
      expect(retrievedData).toBeDefined();
      
      const retrievedText = new TextDecoder().decode(retrievedData);
      expect(retrievedText).toBe(largeContent);
      expect(retrievedText.split('\n').length).toBe(1001);
    });
  });

  describe('File Store Provider Setup', () => {
    it('should have file store provider set up correctly', async () => {
      // Check that the space has a file store provider
      const fileStore = space.getFileStore();
      expect(fileStore).toBeTruthy();

      // Test that we can store and retrieve data
      const testContent = 'test content';
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      
      const put = await fileStore!.putBytes(new TextEncoder().encode(testContent), 'text/plain');
      expect(put.hash).toBeDefined();

      const retrievedData = await fileStore!.getBytes(put.hash);
      const retrievedText = new TextDecoder().decode(retrievedData);
      expect(retrievedText).toBe(testContent);
    });
  });
});
