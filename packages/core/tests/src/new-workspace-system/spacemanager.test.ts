import { Space, SpaceManager2, VertexOperation, } from '@sila/core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestInMemorySyncLayer } from './TestInMemorySyncLayer';

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