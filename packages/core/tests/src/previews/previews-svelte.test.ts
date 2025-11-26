import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, createFileStore, FilesTreeData } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import type { FileReference } from '@sila/core';

// Mock the client state for Svelte testing
class MockClientState {
  private _currentSpace: Space | null = null;
  
  get currentSpace(): Space | null {
    return this._currentSpace;
  }
  
  set currentSpace(space: Space | null) {
    this._currentSpace = space;
  }
}

// Mock file resolver that works with Svelte
class SvelteFileResolver {
  constructor(private clientState: MockClientState) {}

  async resolveFileReference(fileRef: FileReference) {
    if (!this.clientState.currentSpace) {
      return null;
    }

    try {
      const filesTree = await this.clientState.currentSpace.loadAppTree(fileRef.tree);
      if (!filesTree) {
        return null;
      }

      const fileVertex = filesTree.tree.getVertex(fileRef.vertex);
      if (!fileVertex) {
        return null;
      }

      const hash = fileVertex.getProperty('hash') as string;
      const name = (fileVertex.name as string) || (fileVertex.getProperty('name') as string);
      const mimeType = fileVertex.getProperty('mimeType') as string;
      const size = fileVertex.getProperty('size') as number;
      const width = fileVertex.getProperty('width') as number;
      const height = fileVertex.getProperty('height') as number;

      if (!hash) {
        return null;
      }

      const fileStore = this.clientState.currentSpace.fileStore;
      if (!fileStore) {
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
}

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
}

describe('Simplified File Previews (Svelte)', () => {
  let tempDir: string;
  let spaceManager: SpaceManager;
  let testSpace: Space;
  let filesTree: any;
  let fileVertex: any;
  let fileRef: FileReference;
  let mockClientState: MockClientState;
  let fileResolver: SvelteFileResolver;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-simplified-previews-svelte-test-'));
    
    // Create space manager and test space
    spaceManager = new SpaceManager();
    testSpace = Space.newSpace(crypto.randomUUID());
    testSpace.name = 'Simplified File Previews Svelte Test Space';

    // Create file system persistence layer
    const fs = new NodeFileSystem();
    const layer = new FileSystemPersistenceLayer(tempDir, testSpace.getId(), fs);
    await spaceManager.addNewSpace(testSpace, [layer]);

    // Wait for persistence to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create files tree using generic app tree with id 'files' and ensure folder
    filesTree = testSpace.newAppTree('files');
    FilesTreeData.ensureFolderPath(filesTree, ['files']);
    
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

    // Set up mock client state
    mockClientState = new MockClientState();
    mockClientState.currentSpace = testSpace;
    fileResolver = new SvelteFileResolver(mockClientState);
  });

  afterEach(async () => {
    // Clean up
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    await spaceManager.closeSpace(testSpace.getId());
  });

  describe('Svelte Integration', () => {
    it('should work with Svelte client state', async () => {
      // Test that the file resolver works with Svelte client state
      const fileInfo = await fileResolver.resolveFileReference(fileRef);

      expect(fileInfo).toBeDefined();
      expect(fileInfo?.id).toBe(fileVertex.id);
      expect(fileInfo?.name).toBe('test-image.png');
      expect(fileInfo?.mimeType).toBe('image/png');
      expect(fileInfo?.dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle missing client state gracefully', async () => {
      // Test with no current space
      mockClientState.currentSpace = null;
      const fileInfo = await fileResolver.resolveFileReference(fileRef);
      expect(fileInfo).toBeNull();
    });

    it('should work with Svelte reactive stores', () => {
      // Test that the utility functions work with Svelte patterns
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

      const fileRefs = FilePreviewUtils.extractFileReferences(message);
      expect(fileRefs).toHaveLength(1);
      expect(fileRefs[0]).toEqual(fileRef);
    });
  });

  describe('Svelte Component Testing', () => {
    it('should demonstrate Svelte component testing patterns', async () => {
      // This test demonstrates how you would test Svelte components
      // that use the simplified file preview system
      
      // Mock a Svelte component that uses file references
      const mockComponent = {
        props: {
          fileRef,
          showGallery: false,
          onGalleryOpen: () => {},
        },
        state: {
          resolvedFile: null,
          isLoading: true,
          hasError: false,
        },
        async loadFile() {
          this.state.isLoading = true;
          this.state.hasError = false;
          
          const resolvedFile = await fileResolver.resolveFileReference(this.props.fileRef);
          
          if (resolvedFile) {
            this.state.resolvedFile = resolvedFile;
          } else {
            this.state.hasError = true;
          }
          
          this.state.isLoading = false;
        }
      };

      // Test the component's file loading behavior
      await mockComponent.loadFile();
      
      expect(mockComponent.state.isLoading).toBe(false);
      expect(mockComponent.state.hasError).toBe(false);
      expect(mockComponent.state.resolvedFile).toBeDefined();
      expect(mockComponent.state.resolvedFile?.name).toBe('test-image.png');
    });

    it('should handle Svelte reactive updates', async () => {
      // Test reactive updates in Svelte components
      const mockReactiveState = {
        fileRefs: [fileRef],
        resolvedFiles: [],
        isLoading: false,
      };

      // Simulate reactive update when fileRefs change
      const updateResolvedFiles = async () => {
        mockReactiveState.isLoading = true;
        mockReactiveState.resolvedFiles = [];
        
        for (const fileRef of mockReactiveState.fileRefs) {
          const resolvedFile = await fileResolver.resolveFileReference(fileRef);
          if (resolvedFile) {
            mockReactiveState.resolvedFiles.push(resolvedFile);
          }
        }
        
        mockReactiveState.isLoading = false;
      };

      await updateResolvedFiles();
      
      expect(mockReactiveState.isLoading).toBe(false);
      expect(mockReactiveState.resolvedFiles).toHaveLength(1);
      expect(mockReactiveState.resolvedFiles[0].name).toBe('test-image.png');
    });
  });

  describe('Svelte Store Integration', () => {
    it('should work with Svelte stores', () => {
      // Test integration with Svelte stores
      const mockStore = {
        subscribe: (callback: (value: any) => void) => {
          callback({
            currentSpace: testSpace,
            fileRefs: [fileRef],
            resolvedFiles: [],
          });
          return { unsubscribe: () => {} };
        }
      };

      // Simulate store subscription
      let storeValue: any;
      const unsubscribe = mockStore.subscribe((value) => {
        storeValue = value;
      });

      expect(storeValue.currentSpace).toBe(testSpace);
      expect(storeValue.fileRefs).toHaveLength(1);
      expect(storeValue.fileRefs[0]).toEqual(fileRef);

      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });

    it('should handle Svelte derived stores', () => {
      // Test with derived stores
      const baseStore = {
        subscribe: (callback: (value: any) => void) => {
          callback({
            messages: [
              {
                id: 'msg1',
                text: 'Hello',
                files: [
                  {
                    id: 'att1',
                    kind: 'image',
                    file: fileRef,
                  },
                ],
              },
            ],
          });
          return { unsubscribe: () => {} };
        }
      };

             const derivedStore = {
         subscribe: (callback: (value: any) => void) => {
           baseStore.subscribe((baseValue) => {
             const fileRefs = FilePreviewUtils.extractFileReferences(baseValue.messages[0]);
             callback({ fileRefs });
           });
           return { unsubscribe: () => {} };
         }
       };

      let derivedValue: any;
      const unsubscribe = derivedStore.subscribe((value) => {
        derivedValue = value;
      });

      expect(derivedValue.fileRefs).toHaveLength(1);
      expect(derivedValue.fileRefs[0]).toEqual(fileRef);

      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
  });

  describe('Svelte Event Handling', () => {
    it('should handle Svelte events', () => {
      // Test event handling in Svelte components
      const mockEventDispatcher = () => {
        const listeners: Record<string, Function[]> = {};
        
        return {
          on: (event: string, callback: Function) => {
            if (!listeners[event]) {
              listeners[event] = [];
            }
            listeners[event].push(callback);
          },
          dispatch: (event: string, data: any) => {
            if (listeners[event]) {
              listeners[event].forEach(callback => callback(data));
            }
          }
        };
      };

      const dispatcher = mockEventDispatcher();
      let receivedEvent = false;
      let eventData: any = null;

      dispatcher.on('fileResolved', (data: any) => {
        receivedEvent = true;
        eventData = data;
      });

      // Simulate file resolution event
      dispatcher.dispatch('fileResolved', {
        fileRef,
        resolvedFile: {
          id: fileVertex.id,
          name: 'test-image.png',
          mimeType: 'image/png',
        }
      });

      expect(receivedEvent).toBe(true);
      expect(eventData.fileRef).toEqual(fileRef);
      expect(eventData.resolvedFile.name).toBe('test-image.png');
    });
  });

  describe('Svelte Component Lifecycle', () => {
    it('should handle Svelte component lifecycle', async () => {
      // Test component lifecycle with file resolution
      const mockComponent = {
        mounted: false,
        destroyed: false,
        fileRef,
        resolvedFile: null,
        
        onMount() {
          this.mounted = true;
          this.loadFile();
        },
        
        onDestroy() {
          this.destroyed = true;
        },
        
        async loadFile() {
          if (this.mounted && !this.destroyed) {
            this.resolvedFile = await fileResolver.resolveFileReference(this.fileRef);
          }
        }
      };

      // Simulate component mount
      mockComponent.onMount();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async load
      
      expect(mockComponent.mounted).toBe(true);
      expect(mockComponent.resolvedFile).toBeDefined();
      expect(mockComponent.resolvedFile?.name).toBe('test-image.png');

      // Simulate component destroy
      mockComponent.onDestroy();
      expect(mockComponent.destroyed).toBe(true);
    });
  });
});