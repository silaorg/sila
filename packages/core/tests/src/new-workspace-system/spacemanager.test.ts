import { Space, SpaceManager2, VertexOperation, } from '@sila/core';
import { describe, it, expect, beforeAll, afterAll, test } from 'vitest';
import { TestInMemorySyncLayer } from './TestInMemorySyncLayer';
import { FileSystemSyncLayer } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';
import uuid from "../../../src/utils/uuid";

describe('Space creation and file-system persistence', () => {

  it("Throws immidiately if we try to load a space without layers in a manager", async () => {
    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => []
    });

    const startTime = performance.now();
    const spaceLoadPromise = spaceManager.loadSpace("-");
    const durationToLoadSpace = performance.now() - startTime;
    await expect(spaceLoadPromise).rejects.toThrow();
    expect(durationToLoadSpace).toBeLessThan(10);
  });

  it("Throws if it takes too long to load it", async () => {
    const timeout = 500;
    const originalSpace = Space.newSpace('test');
    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => [new TestInMemorySyncLayer(originalSpace, timeout * 1000)],
      timeoutForSpaceLoading: timeout
    });

    const startTime = performance.now();
    const spaceLoadPromise = spaceManager.loadSpace("-");
    await expect(spaceLoadPromise).rejects.toThrow();
    const durationToLoadSpace = performance.now() - startTime;
    expect(durationToLoadSpace).toBeGreaterThan(timeout * 0.9);
    expect(durationToLoadSpace).toBeLessThan(timeout * 1.1);
  });

  it("Creates a new space manager and syncs", async () => {
    const spaceId = 'test-space';
    const spaceUri = 'test:' + spaceId;
    const originalSpace = Space.newSpace(spaceId);
    originalSpace.name = "I'm Space";
    const shortestSyncLayerDelay = 1000;

    // We setup 3 sync layers with different delays.
    // We would expect the space to load in around the shortest delay.
    const syncLayers = [
      new TestInMemorySyncLayer(originalSpace, shortestSyncLayerDelay * 2),
      new TestInMemorySyncLayer(originalSpace, shortestSyncLayerDelay * 3),
      new TestInMemorySyncLayer(originalSpace, shortestSyncLayerDelay)
    ];

    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => syncLayers
    });

    const startTime = performance.now();

    const space = await spaceManager.loadSpace(spaceUri);
    expect(space.id).toBe(originalSpace.id);
    expect(space.name).toBe(originalSpace.name);

    // Space should load in around the shortest sync layer delay.
    const durationToLoadSpace = performance.now() - startTime;
    expect(durationToLoadSpace).toBeGreaterThan(shortestSyncLayerDelay - 100);
    expect(durationToLoadSpace).toBeLessThan(shortestSyncLayerDelay + 100);

    const duplicateSpaceManager = new SpaceManager2({
      setupSyncLayers: () => syncLayers
    });

    const duplicateSpace = await duplicateSpaceManager.loadSpace(spaceUri);
    expect(duplicateSpace.id).toBe(originalSpace.id);
    expect(duplicateSpace.name).toBe(originalSpace.name);

    duplicateSpace.name = "I'm a duplicate space";
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(originalSpace.name).toBe("I'm a duplicate space");
  });

  it("Syncs updates to space trees", async () => {
    const spaceId = 'test-space';
    const spaceUri = 'test:' + spaceId;
    const originalPeer = "peer-0";
    // Don't test against this space, use spaces derived from it with SpaceManagers and SyncLayers
    const originalSpace_for_sync_layer_only = Space.newSpace(originalPeer);
    originalSpace_for_sync_layer_only.name = "I'm Space";

    const syncLayers = [
      new TestInMemorySyncLayer(originalSpace_for_sync_layer_only, 0)
    ];

    const spaceManagerA = new SpaceManager2({
      setupSyncLayers: () => syncLayers
    });

    const spaceA = await spaceManagerA.loadSpace(spaceUri);
    const spaceManagerB = new SpaceManager2({
      setupSyncLayers: () => syncLayers
    });

    const spaceB = await spaceManagerB.loadSpace(spaceUri);
    expect(spaceB.id).toBe(spaceA.id);
    expect(spaceB.name).toBe(spaceA.name);

    spaceB.name = "I'm a duplicate space";
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(spaceA.name).toBe("I'm a duplicate space");

    let appTreeId: string;
    // Create an app tree in spaceA
    {
      const appTree = spaceA.newAppTree("test-app");
      appTreeId = appTree.id;
      const v = appTree.tree.root!.newNamedChild("test-child");
      v.setProperty("message", "Hello");
    }

    await new Promise(resolve => setTimeout(resolve, 10));

    // Load the app tree in spaceB
    {
      const appTree = await spaceB.loadAppTree(appTreeId);
      expect(appTree).toBeTruthy();
      const v = appTree!.tree.getVertexByPath("test-child");
      expect(v).toBeTruthy();
      expect(v!.getProperty("message")).toBe("Hello");
    }
  });

  it("continues loading if one layer fails", async () => {
    const spaceId = 'test-resilience';
    const spaceUri = 'test:' + spaceId;
    const originalSpace = Space.newSpace(spaceId);

    // A layer that throws
    const failingLayer = new TestInMemorySyncLayer(originalSpace, {
      shouldFailToLoadSpace: true,
      shouldFailToLoadTree: true
    });

    // A valid layer
    const validLayer = new TestInMemorySyncLayer(originalSpace, 50);

    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => [failingLayer, validLayer]
    });

    const space = await spaceManager.loadSpace(spaceUri);
    expect(space.id).toBe(originalSpace.id);
    expect(space.name).toBe(originalSpace.name);
  });

  /**
   * Fuzzy test that verifies SpaceManager can reconstruct a space from fragmented data scattered across multiple layers. 
   * We randomly distribute operations among 3 layers (simulating partial syncs) and assert that the manager 
   * successfully merges them to reach the correct eventual state.
   */
  it("fuzzy test: reconstructs space from fragmented data", async () => {
    // Run 10 times with random permutations
    for (let i = 0; i < 10; i++) {
      const spaceId = `test-fragmented-${i}`;
      const spaceUri = 'test:' + spaceId;
      const originalSpace = Space.newSpace(spaceId);
      originalSpace.name = "Fragmented Space " + i;

      // generate ~100 ops
      const root = originalSpace.tree.root!;
      for (let j = 0; j < 100; j++) {
        root.setProperty(`prop-${j}`, `val-${j}`);
      }

      const allOps = originalSpace.tree.getAllOps() as VertexOperation[];
      const opsCount = allOps.length;

      // 3 layers
      // We want to ensure that for every op, at least one layer has it.
      // We'll create a map: opIndex -> [layerIndex1, layerIndex2, ...]
      const opDistribution = new Map<number, number[]>();

      for (let opIdx = 0; opIdx < opsCount; opIdx++) {
        const layersForOp: number[] = [];
        // Randomly assign to layers, but ensure at least one
        const assignedLayer = Math.floor(Math.random() * 3);
        layersForOp.push(assignedLayer);

        // Optionally add to other layers
        for (let l = 0; l < 3; l++) {
          if (l !== assignedLayer && Math.random() > 0.5) {
            layersForOp.push(l);
          }
        }
        opDistribution.set(opIdx, layersForOp);
      }

      const layers = [0, 1, 2].map(layerIndex => {
        return new TestInMemorySyncLayer(originalSpace, {
          loadDelayMs: Math.random() * 20, // Random delays
          shouldExcludeOp: (op, opIndex) => {
            const layersForThisOp = opDistribution.get(opIndex);
            // If this layer is NOT in the list for this op, exclude it.
            return !layersForThisOp?.includes(layerIndex);
          }
        });
      });

      const spaceManager = new SpaceManager2({
        setupSyncLayers: () => layers
      });

      const space = await spaceManager.loadSpace(spaceUri);
      expect(space.id).toBe(originalSpace.id);

      const waitFor = async (condition: () => boolean, timeout = 2000) => {
        const start = performance.now();
        while (!condition() && performance.now() - start < timeout) {
          await new Promise(r => setTimeout(r, 10));
        }
        if (!condition()) throw new Error("Timeout waiting for condition");
      };

      await waitFor(() => space.name === originalSpace.name);
      expect(space.name).toBe(originalSpace.name);

      // Check a few properties to be sure
      // We must wait for EACH property because layers might return them at different times (parallel loading)
      await waitFor(() => space.tree.root!.getProperty("prop-0") === "val-0");
      await waitFor(() => space.tree.root!.getProperty("prop-99") === "val-99");

      expect(space.tree.root!.getProperty("prop-0")).toBe("val-0");
      expect(space.tree.root!.getProperty("prop-99")).toBe("val-99");
    }
  });

});

describe('FileSystemSyncLayer - Real file persistence', () => {
  let tempDir: string;
  let fs: NodeFileSystem;

  beforeAll(() => {
    fs = new NodeFileSystem();
  });

  afterAll(async () => {
    // Clean up temp directories
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.error("Error cleaning up temp directory:", error);
      }
    }
  });

  it("saves files to disk and can reload them", async () => {
    // Create a unique temp directory for this test
    tempDir = join(tmpdir(), `sila-test-${Date.now()}`);
    const spaceId = 'test-fs-space';
    const spaceUri = 'fs:' + spaceId;

    // Create a sync layer pointing to temp directory
    const syncLayer = new FileSystemSyncLayer(tempDir, spaceId, fs);

    // Create a space manager with the file system sync layer
    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => [syncLayer]
    });

    // Create and modify a space
    const originalSpace = Space.newSpace(spaceId);
    originalSpace.name = "Test File System Space";
    originalSpace.tree.root!.setProperty("test-prop", "test-value");
    originalSpace.tree.root!.setProperty("another-prop", 42);

    // Add space to manager so it gets synced
    spaceManager.addSpace(originalSpace, spaceUri);

    // Wait for initial sync to complete (this triggers saveTreeOps)
    const runner = (spaceManager as any).spaceRunners.get(spaceUri);
    if (runner && runner.initSync) {
      await runner.initSync;
    }

    // Wait for sync to complete
    await new Promise(resolve => setTimeout(resolve, 600));

    // Verify directory structure was created
    expect(await fs.exists(tempDir)).toBe(true);
    expect(await fs.exists(join(tempDir, 'space-v1'))).toBe(true);
    expect(await fs.exists(join(tempDir, 'space-v1', 'ops'))).toBe(true);
    expect(await fs.exists(join(tempDir, 'sila.md'))).toBe(true);
    expect(await fs.exists(join(tempDir, 'space-v1', 'space.json'))).toBe(true);

    // Verify space.json contains correct ID
    const spaceJson = JSON.parse(await fs.readTextFile(join(tempDir, 'space-v1', 'space.json')));
    expect(spaceJson.id).toBe(originalSpace.id); // Use actual space ID, not the string we passed

    // The actual tree ID is originalSpace.id, not the spaceId string we used for the URI
    const actualTreeId = originalSpace.id;

    // Verify JSONL files were created - use actualTreeId
    const treeIdPrefix = actualTreeId.substring(0, 2);
    const treeIdSuffix = actualTreeId.substring(2);
    const opsDir = join(tempDir, 'space-v1', 'ops', treeIdPrefix, treeIdSuffix);

    // Check that ops directory for this tree exists
    expect(await fs.exists(opsDir)).toBe(true);

    // Find the date directory (year/month/day)
    const yearDirs = await fs.readDir(opsDir);
    expect(yearDirs.length).toBeGreaterThan(0);

    const yearDir = yearDirs.find(d => d.isDirectory && d.name.match(/^\d{4}$/));
    expect(yearDir).toBeTruthy();

    const monthDirs = await fs.readDir(join(opsDir, yearDir!.name));
    const monthDir = monthDirs.find(d => d.isDirectory && d.name.match(/^\d{2}$/));
    expect(monthDir).toBeTruthy();

    const dayDirs = await fs.readDir(join(opsDir, yearDir!.name, monthDir!.name));
    const dayDir = dayDirs.find(d => d.isDirectory && d.name.match(/^\d{2}$/));
    expect(dayDir).toBeTruthy();

    const jsonlDir = join(opsDir, yearDir!.name, monthDir!.name, dayDir!.name);
    const jsonlFiles = await fs.readDir(jsonlDir);

    // Should have at least move ops and property ops files
    const moveOpsFile = jsonlFiles.find(f => f.name.endsWith('-m.jsonl'));
    const propOpsFile = jsonlFiles.find(f => f.name.endsWith('-p.jsonl'));

    expect(moveOpsFile).toBeTruthy();
    expect(propOpsFile).toBeTruthy();

    // Verify file contents contain operations
    const moveOpsContent = await fs.readTextFile(join(jsonlDir, moveOpsFile!.name));
    expect(moveOpsContent.length).toBeGreaterThan(0);
    // Move ops should have JSONL format: [counter, "targetId", parentId]
    expect(moveOpsContent).toContain('[');
    expect(moveOpsContent).toContain('null'); // Root has null parent

    const propOpsContent = await fs.readTextFile(join(jsonlDir, propOpsFile!.name));
    expect(propOpsContent.length).toBeGreaterThan(0);
    expect(propOpsContent).toContain("test-prop");
    expect(propOpsContent).toContain("test-value");
    expect(propOpsContent).toContain("another-prop");

    // Dispose first sync layer to flush pending writes
    await syncLayer.dispose();

    // Now create a NEW space manager that loads from the same directory
    const syncLayer2 = new FileSystemSyncLayer(tempDir, spaceId, fs);

    const spaceManager2 = new SpaceManager2({
      setupSyncLayers: () => [syncLayer2]
    });

    const loadedSpace = await spaceManager2.loadSpace(spaceUri);

    // Verify loaded space has the same data - ID should match the original space's ID
    expect(loadedSpace.id).toBe(originalSpace.id);
    expect(loadedSpace.name).toBe("Test File System Space");
    expect(loadedSpace.tree.root!.getProperty("test-prop")).toBe("test-value");
    expect(loadedSpace.tree.root!.getProperty("another-prop")).toBe(42);

    await syncLayer2.dispose();
  });

  it("handles app tree operations", async () => {
    // Create a new temp directory for this test
    tempDir = join(tmpdir(), `sila-test-apptree-${Date.now()}`);
    const spaceId = 'test-apptree-space';
    const spaceUri = 'fs:' + spaceId;

    const syncLayer = new FileSystemSyncLayer(tempDir, spaceId, fs);

    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => [syncLayer]
    });

    const originalSpace = Space.newSpace(spaceId);
    originalSpace.name = "App Tree Test Space";

    spaceManager.addSpace(originalSpace, spaceUri);

    // Wait for sync to start (sync starts immediately for exists spaces now)
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create an app tree
    const appTree = originalSpace.newAppTree("my-app");
    const child = appTree.tree.root!.newNamedChild("child-node");
    child.setProperty("message", "Hello from app tree");

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 600));

    await syncLayer.dispose();

    // Load from disk with a new manager
    const syncLayer2 = new FileSystemSyncLayer(tempDir, spaceId, fs);

    const spaceManager2 = new SpaceManager2({
      setupSyncLayers: () => [syncLayer2]
    });

    const loadedSpace = await spaceManager2.loadSpace(spaceUri);

    // Give it time to load the app tree
    await new Promise(resolve => setTimeout(resolve, 100));

    const loadedAppTree = await loadedSpace.loadAppTree(appTree.id);
    expect(loadedAppTree).toBeTruthy();

    const loadedChild = loadedAppTree!.tree.getVertexByPath("child-node");
    expect(loadedChild).toBeTruthy();
    expect(loadedChild!.getProperty("message")).toBe("Hello from app tree");

    await syncLayer2.dispose();
  });

  test("Secret Management", async () => {
    const spaceId = uuid();
    const spaceUri = spaceId;

    const originalSpace = Space.newSpace(spaceId);
    // Setup initial layer
    const syncLayer = new TestInMemorySyncLayer(originalSpace, 0);

    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => [syncLayer]
    });

    spaceManager.addSpace(originalSpace, spaceUri);
    const space = await spaceManager.loadSpace(spaceUri);

    // Set a secret
    space.setSecret("api-key", "secret-value-123");

    // Verify it's in the layer
    expect(syncLayer.secrets["api-key"]).toBe("secret-value-123");

    // Load from "disk" (memory in this case) with a new manager
    const syncLayer2 = new TestInMemorySyncLayer(originalSpace, 0);
    // Manually sync the "storage"
    syncLayer2.secrets = { ...syncLayer.secrets };

    const spaceManager2 = new SpaceManager2({
      setupSyncLayers: () => [syncLayer2]
    });

    // Load the space
    const loadedSpace = await spaceManager2.loadSpace(spaceUri);

    // Verify secret is loaded
    expect(loadedSpace.getSecret("api-key")).toBe("secret-value-123");
  });

  test("FileSystemSyncLayer - Secret Persistence", async () => {
    const spaceId = uuid();
    const spaceUri = spaceId;
    const tempDir = join(tmpdir(), `sila-test-secrets-${spaceId}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const originalSpace = Space.newSpace(spaceId);
      const fs = new NodeFileSystem();
      const syncLayer = new FileSystemSyncLayer(tempDir, spaceId, fs);

      const spaceManager = new SpaceManager2({
        setupSyncLayers: () => [syncLayer]
      });

      spaceManager.addSpace(originalSpace, spaceUri);
      const space = await spaceManager.loadSpace(spaceUri);

      // Set a secret
      space.setSecret("fs-secret-key", "fs-secret-value");

      // Save ops (which might trigger secret saving if implementation was coupled, but we have separate secret saving)
      // Wait a bit for pending promises if any (though secrets are saved via promise chain in sync layer immediately)
      await new Promise(resolve => setTimeout(resolve, 100));

      await syncLayer.dispose();

      // Reload with new layer
      const syncLayer2 = new FileSystemSyncLayer(tempDir, spaceId, fs);
      const spaceManager2 = new SpaceManager2({
        setupSyncLayers: () => [syncLayer2]
      });

      const loadedSpace = await spaceManager2.loadSpace(spaceUri);

      // Verify secret is loaded
      expect(loadedSpace.getSecret("fs-secret-key")).toBe("fs-secret-value");

      await syncLayer2.dispose();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("FileSystemSyncLayer - File Store Persistence", async () => {
    const spaceId = uuid();
    const spaceUri = spaceId;
    const tempDir = join(tmpdir(), `sila-test-files-${spaceId}`);
    const { mkdir } = await import('fs/promises');
    await mkdir(tempDir, { recursive: true });

    try {
      const originalSpace = Space.newSpace(spaceId);
      const nodeFs = new NodeFileSystem();
      const syncLayer = new FileSystemSyncLayer(tempDir, spaceId, nodeFs);

      const spaceManager = new SpaceManager2({
        setupSyncLayers: () => [syncLayer]
      });

      spaceManager.addSpace(originalSpace, spaceUri);
      const space = await spaceManager.loadSpace(spaceUri);

      // Verify file store is attached
      expect(space.fileStore).toBeDefined();

      // Upload a file (simulated by putBytes)
      const content = new TextEncoder().encode("Hello Sila Files");
      const { hash } = await space!.fileStore!.putBytes(content);

      // Verify existence
      expect(await space!.fileStore!.exists(hash)).toBe(true);

      // Verify content
      const loadedBytes = await space!.fileStore!.getBytes(hash);
      expect(new TextDecoder().decode(loadedBytes)).toBe("Hello Sila Files");

      await syncLayer.dispose();

      // Reload
      const syncLayer2 = new FileSystemSyncLayer(tempDir, spaceId, nodeFs);
      const spaceManager2 = new SpaceManager2({
        setupSyncLayers: () => [syncLayer2]
      });

      const loadedSpace = await spaceManager2.loadSpace(spaceUri);

      // Verify file store survives reload (and file persistence)
      expect(loadedSpace.fileStore).toBeDefined();
      expect(await loadedSpace!.fileStore!.exists(hash)).toBe(true);
      const reloadedBytes = await loadedSpace!.fileStore!.getBytes(hash);
      expect(new TextDecoder().decode(reloadedBytes)).toBe("Hello Sila Files");

      await syncLayer2.dispose();
    } catch (e) {
      console.error("Test failed:", e);
      throw e;
    } finally {
      // Give FS a moment to release handles
      await new Promise(r => setTimeout(r, 100));
      await rm(tempDir, { recursive: true, force: true });
    }
  });

});