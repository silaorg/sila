import { Space, SpaceManager2, } from '@sila/core';
import { describe, it, expect, vi } from 'vitest';
import { TestInMemorySyncLayer } from './TestInMemorySyncLayer';

describe('SpaceManager2', () => {
  it("Creates a new space manager and loads space", async () => {
    const originalSpace = Space.newSpace('test-space');

    const onSpaceHandler = vi.fn();

    const spaceManager = new SpaceManager2({
      setupSyncLayers: (spacePointer) => {
        return [new TestInMemorySyncLayer(originalSpace, 10)];
      },
      setupSpaceHandler: onSpaceHandler
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
    expect(onSpaceHandler).toHaveBeenCalledTimes(1);
    expect(spaceManager.activeSpaces.length).toBe(1);

    // Test closeSpace
    await spaceManager.closeSpace('test:test-space');
    expect(spaceManager.activeSpaces.length).toBe(0);
    expect(spaceManager.getSpace('test:test-space')).toBeNull();
  });

  it("Adds an existing space", async () => {
    const onSpaceHandler = vi.fn();
    const spaceManager = new SpaceManager2({
      setupSpaceHandler: onSpaceHandler
    });

    const newSpace = Space.newSpace('manual-space');
    spaceManager.addSpace(newSpace, 'manual:space');

    expect(spaceManager.activeSpaces.length).toBe(1);
    expect(spaceManager.getSpace('manual:space')).toBe(newSpace);
    expect(onSpaceHandler).toHaveBeenCalledWith(expect.objectContaining({ uri: 'manual:space' }), newSpace);
  });
});