import { Space, SpaceManager, FileSystemSyncLayer, type WatchEvent, type UnwatchFn } from '@sila/core';
import { describe, it, expect, vi } from 'vitest';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, mkdtemp } from 'node:fs/promises';
import uuid from '../../../src/utils/uuid';

// Exercise Windows watcher paths even when the test runs on macOS or Linux.
class WindowsWatchFileSystem extends NodeFileSystem {
  async watch(path: string, callback: (event: WatchEvent) => void, options?: { recursive?: boolean }): Promise<UnwatchFn> {
    return super.watch(path, event => callback({ ...event, path: event.path.replace(/\//g, '\\') }), options);
  }

  async readTextFile(path: string): Promise<string> {
    return super.readTextFile(path.replace(/\\/g, '/'));
  }
}

describe('FileSystemSyncLayer two-way sync', () => {
  it.each(['native', 'windows'])('syncs both directions with %s watcher paths', async pathStyle => {
    const spaceId = uuid();
    const spaceUri = `test:${spaceId}`;
    const tempDir = await mkdtemp(join(tmpdir(), 'sila-test-sync-'));
    const fs = pathStyle === 'windows' ? new WindowsWatchFileSystem() : new NodeFileSystem();
    const managerA = new SpaceManager({ setupSyncLayers: () => [new FileSystemSyncLayer(tempDir, spaceId, fs)] });
    const managerB = new SpaceManager({ setupSyncLayers: () => [new FileSystemSyncLayer(tempDir, spaceId, fs)] });

    try {
      const originalSpace = Space.newSpace(spaceId);
      originalSpace.name = 'Initial Name';
      await managerA.addSpace(originalSpace, spaceUri);
      const spaceA = await managerA.loadSpace(spaceUri);
      // Allow the initial operations to be persisted before loading the second peer.
      await new Promise(resolve => setTimeout(resolve, 1000));
      const spaceB = await managerB.loadSpace(spaceUri);
      expect(spaceB.name).toBe('Initial Name');

      spaceA.name = 'Updated by A';
      await vi.waitFor(() => expect(spaceB.name).toBe('Updated by A'), { timeout: 8000 });
      spaceB.name = 'Updated by B';
      await vi.waitFor(() => expect(spaceA.name).toBe('Updated by B'), { timeout: 8000 });
    } finally {
      await managerA.closeSpace(spaceUri);
      await managerB.closeSpace(spaceUri);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 20000);
});
