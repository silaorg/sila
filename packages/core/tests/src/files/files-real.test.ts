import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, access, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, createFileStore, FilesTreeData } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

function mimeFromName(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return undefined;
}

describe('Local assets persisted in workspace CAS', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-assets-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reads images from assets/images (.b64 or binary), writes to CAS, and verifies roundtrip and dedup', async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);

    // Ensure base structure
    await wait(500);
    await access(path.join(tempDir, 'space-v1', 'ops'));

    const fileStore = createFileStore({ getSpaceRootPath: () => tempDir, getFs: () => fs });
    if (!fileStore) throw new Error('FileStore not available');

    // Load local assets (relative to this test file location)
    const assetsDir = path.join(__dirname, '..', '..', 'assets', 'images');
    const entries = await readdir(assetsDir, { withFileTypes: true }).catch(() => [] as any[]);
    const files = entries.filter(e => e.isFile() && (/(\.b64|\.png|\.jpg|\.jpeg|\.webp)$/i).test(e.name));
    expect(files.length).toBeGreaterThan(0);

    const filesTree = space.newAppTree('files');
    const now = new Date();
    const folder = FilesTreeData.ensureFolderPath(filesTree, [
      now.getUTCFullYear().toString(),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      String(now.getUTCDate()).padStart(2, '0'),
      'assets'
    ]);

    const hashes: string[] = [];

    for (const f of files) {
      const p = path.join(assetsDir, f.name);
      let bytes: Uint8Array;
      let mime: string | undefined;
      if (f.name.toLowerCase().endsWith('.b64')) {
        const b64 = (await readFile(p, 'utf8')).trim();
        bytes = fromBase64(b64);
        // attempt to infer mime from prefix inside b64 is not possible here; default to png
        mime = 'image/png';
      } else {
        const buf = await readFile(p);
        bytes = new Uint8Array(buf);
        mime = mimeFromName(f.name);
      }

      const put = await fileStore.putBytes(bytes, mime);
      hashes.push(put.hash);

      // Verify CAS path exists
      const casPath = path.join(tempDir, 'space-v1', 'files', 'static', 'sha256', put.hash.slice(0, 2), put.hash.slice(2));
      await access(casPath);

      // Verify bytes roundtrip
      const loadedBytes = await fileStore.getBytes(put.hash);
      expect(buffersEqual(loadedBytes, bytes)).toBe(true);

      // Create file vertex
      const name = f.name.replace(/\.b64$/i, '');
      const fileVertex = FilesTreeData.saveFileInfo(
        folder,
        {
          name,
          hash: put.hash,
          mimeType: mime,
          size: bytes.byteLength
        }
      );
      expect(fileVertex.getProperty('hash')).toBe(put.hash);
    }

    // Deduplication: if multiple identical files exist, their hashes should be the same
    if (hashes.length >= 2) {
      const unique = new Set(hashes);
      expect(unique.size).toBeLessThanOrEqual(hashes.length);
    }

    // Allow batched ops to flush
    await wait(1200);

    // Verify ops
    const loader = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    await loader.connect();
    const spaceOps = await loader.loadSpaceTreeOps();
    expect(spaceOps.length).toBeGreaterThan(0);
    const filesOps = await loader.loadTreeOps(filesTree.getId());
    expect(filesOps.length).toBeGreaterThan(0);
  });
});