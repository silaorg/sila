import { Space, SpaceManager, FileSystemPersistenceLayer } from '@sila/core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NodeFileSystem } from '../setup/setup-node-file-system';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Secrets persistence', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-secrets-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('saves and loads secrets roundtrip', async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    // Create persistence and add space to manager to enable secret saving hooks
    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Save secrets via wrapped methods
    space.setSecret('api-key-openai', 'sk-123');
    space.setSecret('foo', 'bar');
    space.saveAllSecrets({ ...space.getAllSecrets()! });

    // Allow flush
    await wait(1200);

    // Ensure secrets file exists
    await access(path.join(tempDir, 'space-v1', 'secrets'));

    // Load secrets directly via layer
    const loader = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    await loader.connect();
    const loaded = await loader.loadSecrets();

    expect(loaded).toBeTruthy();
    expect(loaded!.foo).toBe('bar');
    expect(loaded!['api-key-openai']).toBe('sk-123');
  });
});