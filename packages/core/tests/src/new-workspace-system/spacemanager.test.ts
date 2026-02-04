import { Space, SpaceManager2, } from '@sila/core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestInMemorySyncLayer } from './TestInMemorySyncLayer';

describe('Space creation and file-system persistence', () => {

  it("Throws immidiately if we try to load a space without layers in a manager", async () => {
    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => []
    });

    const startTime = performance.now();

    const space = spaceManager.loadSpace({
      id: "-",
      uri: "-",
      name: "-",
      createdAt: new Date(),
      userId: null,
    });

    const durationToLoadSpace = performance.now() - startTime;

    await expect(space).rejects.toThrow();
    expect(durationToLoadSpace).toBeLessThan(10);
  });

  it("Throws if it takes too long to load it", async () => {
    const timeout = 500;
    const originalSpace = Space.newSpace('test');
    const spaceManager = new SpaceManager2({
      setupSyncLayers: () => [new TestInMemorySyncLayer(originalSpace, timeout * 1000)]
    });
    spaceManager.timeoutForSpaceLoading = timeout;

    const space = spaceManager.loadSpace({
      id: "-",
      uri: "-",
      name: "-",
      createdAt: new Date(),
      userId: null,
    });

    await expect(space).rejects.toThrow();
  });

  it("Creates a new space manager", async () => {
    const spaceId = 'test-space';
    const originalSpace = Space.newSpace(spaceId);
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
    const space = await spaceManager.loadSpace({
      id: spaceId,
      uri: 'test:test-space',
      name: 'test-space',
      createdAt: new Date(),
      userId: null,
    });

    expect(space.id).toBe(originalSpace.id);

    const durationToLoadSpace = performance.now() - startTime;
    // Space should load in around the shortest sync layer delay.
    expect(durationToLoadSpace).toBeGreaterThan(shortestSyncLayerDelay - 100);
    expect(durationToLoadSpace).toBeLessThan(shortestSyncLayerDelay + 100);
  });
});