
import { Space, SpaceManager } from '@sila/core';
import { describe, it, expect, afterEach } from 'vitest';
import { FileSystemSyncLayer } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm, mkdir } from 'fs/promises';
import uuid from "../../../src/utils/uuid";

describe('FileSystemSyncLayer Two-Way Sync', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    // Cleanup
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('Syncs changes between two managers watching the same directory', async () => {
    const spaceId = uuid();
    const spaceUri = 'test:' + spaceId;
    const tempDir = join(tmpdir(), `sila-test-sync-${spaceId}`);
    await mkdir(tempDir, { recursive: true });
    tempDirs.push(tempDir);

    const fs = new NodeFileSystem();

    // Debug: Verify fs.watch works independently
    await new Promise<void>(async (resolve) => {
      const debugFile = join(tempDir, 'debug.txt');
      const unwatch = await fs.watch(tempDir, (event) => {
        console.log('DEBUG: Direct fs.watch event:', event);
      });
      await import('fs/promises').then(m => m.writeFile(debugFile, 'test'));
      setTimeout(() => { unwatch(); resolve(); }, 500);
    });

    // --- Peer A Setup ---
    const syncLayerA = new FileSystemSyncLayer(tempDir, spaceId, fs);
    const spaceManagerA = new SpaceManager({
      setupSyncLayers: () => [syncLayerA]
    });

    // Initialize space in A
    const originalSpace = Space.newSpace(spaceId);
    originalSpace.name = "Initial Name";
    await spaceManagerA.addSpace(originalSpace, spaceUri);
    const spaceA = await spaceManagerA.loadSpace(spaceUri);

    // Wait for ops to be flushed to disk
    // In a real app, we might rely on the periodic save interval or explicit flush
    // Here we just wait a bit to ensure the file system has the data
    await new Promise(resolve => setTimeout(resolve, 1000));

    // --- Peer B Setup ---
    // Peer B points to the same directory
    const syncLayerB = new FileSystemSyncLayer(tempDir, spaceId, fs);
    const spaceManagerB = new SpaceManager({
      setupSyncLayers: () => [syncLayerB]
    });

    // Load space in B
    const spaceB = await spaceManagerB.loadSpace(spaceUri);
    expect(spaceB.name).toBe("Initial Name");

    // --- Test Sync A -> B ---
    spaceA.name = "Updated by A";

    // Wait for file system watch events to propagate
    // This involves: A saves to disk -> FS event -> B sees event -> B reads file -> B updates state
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(spaceB.name).toBe("Updated by A");

    // --- Test Sync B -> A ---
    spaceB.name = "Updated by B";

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(spaceA.name).toBe("Updated by B");

    // Cleanup managers/layers
    // @ts-ignore - access private/protected if needed, or just rely on GC/test cleanup
    // Ideally we should have a close/dispose method on SpaceManager to close layers
    await syncLayerA.dispose();
    await syncLayerB.dispose();
  }, 10000); // Increased timeout for FS operations
});
