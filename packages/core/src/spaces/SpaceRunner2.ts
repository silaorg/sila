import { SyncLayer, VertexOperation } from "@sila/core";
import { Space } from "./Space";
import { SpacePointer2 } from "./SpaceManager2";

/**
 * Runs a space in memory and syncs them between peers with the help of sync layers.
 * It's used by SpaceManager where SpaceManager creates instances of SpaceRunner
 * for each space.
 */
export class SpaceRunner2 {

  /**
   * Create a new space runner from an existing space that we have in memory
   * @param space 
   * @param pointer 
   * @param layers 
   */
  static fromExistingSpace(space: Space, pointer: SpacePointer2, layers: SyncLayer[]): SpaceRunner2 {
    return new SpaceRunner2(pointer, layers, space);
  }

  /**
   * Create a new space runner from a pointer. This will load the space from the layers.
   * @param pointer 
   * @param layers 
   */
  static fromPointer(pointer: SpacePointer2, layers: SyncLayer[]): SpaceRunner2 {
    return new SpaceRunner2(pointer, layers);
  }

  space: Space | null = null;
  initSync: Promise<void> | null = null;

  private constructor(readonly pointer: SpacePointer2, readonly layers: SyncLayer[], space?: Space) {
    this.space = space ?? null;
    this.initSync = this.startSync();
  }

  private async startSync() {
    const accumulatedOps: VertexOperation[] = [];

    // We build a space this way so it can be built as fast as possible.
    // As soon as we get the first layer that has enough ops to build a space
    // we create it and can use it immidiately without waiting for all layers to load.
    await Promise.all(this.layers.map(async layer => {
      accumulatedOps.push(...await layer.loadSpaceTreeOps());
      if (accumulatedOps.length === 0) return;

      if (!this.space) {
        // We do it in try catch in case if the space ops can't create a valid space. 
        // We will carry the ops we accumulated to the next cycle if space creation fails.
        try {
          const space = Space.existingSpaceFromOps(accumulatedOps);
          accumulatedOps.length = 0;
          this.space = space;
        } catch (e) {
          return;
        }
      }

      this.space.tree.merge(accumulatedOps);
      accumulatedOps.length = 0;
    }));
  }

  async dispose() {
    await Promise.all(this.layers.map(layer => layer.disconnect()));
    this.space = null;
  }
}