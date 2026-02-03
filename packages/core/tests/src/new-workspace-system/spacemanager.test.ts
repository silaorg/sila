import { Space, SpaceManager2, } from '@sila/core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestInMemorySyncLayer } from './TestInMemorySyncLayer';

describe('Space creation and file-system persistence', () => {
  it("Creates a new space manager", async () => {

    // @TODO: create a test sync layer that can sync changes between instances of spaces
    // in tests

    const originalSpace = Space.newSpace('test-space');

    const spaceManager = new SpaceManager2({
      setupSyncLayers: (spacePointer) => {
        return [new TestInMemorySyncLayer(originalSpace, 1000)];
      },
    });

    const space = await spaceManager.loadSpace({
      id: 'test-space',
      uri: 'test:test-space',
      name: 'test-space',
      createdAt: new Date(),
      userId: null,
    });

    expect(space).toBeTruthy();
    expect(space?.getId()).toBe(originalSpace.getId());
  });
});