import { Space, SpaceManager2, } from '@sila/core';
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

  it("Creates a new space manager", async () => {
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

    // Create an app tree in the duplicate space
    {
      const appTree = duplicateSpace.newAppTree("test-app-tree");
      const v = appTree.tree.root!.newNamedChild("test-child");
      v.setProperty("message", "Hello");
    }

    // Load the app tree in the original space
    {
      const appTree = await originalSpace.loadAppTree("test-app-tree");
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(appTree).toBeTruthy();
      const v = appTree!.tree.getVertexByPath("test-child");
      expect(v).toBeTruthy();
      expect(v!.getProperty("message")).toBe("Hello");
    }
  });
});