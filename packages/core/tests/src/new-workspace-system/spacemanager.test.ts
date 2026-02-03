import { Space, SpaceManager2, } from '@sila/core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Space creation and file-system persistence', () => {
  it("Creates a new space manager", () => {

    // @TODO: create a test sync layer that can sync changes between instances of spaces
    // in tests

    const spaceManager = new SpaceManager2({
      enableBacked: false,
      setupSyncLayers: (spacePointer) => {
        return [];
      },
    });

    const space = Space.newSpace('test-space');
    spaceManager.addSpace(space, 'test:test-space');



  });
});