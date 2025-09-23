import { Space, SpaceManager, FileSystemPersistenceLayer } from '@sila/core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NodeFileSystem } from '../setup/setup-node-file-system';

describe('Space creation and file-system persistence', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-space-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates a new space and persists it to disk, then loads it back', async () => {
    const fs = new NodeFileSystem();

    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    space.name = 'Test Space';

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Wait for batched save to flush (layer uses ~500ms interval)
    await new Promise((r) => setTimeout(r, 1500));

    // Verify basic structure files exist
    await access(path.join(tempDir, 'sila.md'));
    const spaceJsonPath = path.join(tempDir, 'space-v1', 'space.json');
    const spaceJson = JSON.parse(await readFile(spaceJsonPath, 'utf8'));
    expect(spaceJson.id).toBe(spaceId);

    // Load ops back and reconstruct the space
    const loadLayer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    await loadLayer.connect();
    const ops = await loadLayer.loadSpaceTreeOps();
    expect(ops.length).toBeGreaterThan(0);

    const loaded = Space.existingSpaceFromOps(ops);
    expect(loaded).toBeTruthy();
    expect(Space.isValid(loaded.tree)).toBe(true);
    expect(loaded.name).toBe('Test Space');
  });
});