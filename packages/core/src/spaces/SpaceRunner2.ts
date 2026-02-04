import { SyncLayer, VertexOperation } from "@sila/core";
import { Space } from "./Space";

/**
 * Runs a space in memory and syncs them between peers with the help of sync layers.
 * It's used by SpaceManager where SpaceManager creates instances of SpaceRunner
 * for each space.
 */
export class SpaceRunner2 {

  /**
   * Create a new space runner from an existing space that we have in memory
   * @param space 
   * @param uri 
   * @param layers 
   */
  static fromExistingSpace(space: Space, uri: string, layers: SyncLayer[]): SpaceRunner2 {
    return new SpaceRunner2(uri, layers, space);
  }

  /**
   * Create a new space runner from a URI. This will load the space from the layers.
   * @param uri 
   * @param layers 
   */
  static fromURI(uri: string, layers: SyncLayer[]): SpaceRunner2 {
    return new SpaceRunner2(uri, layers);
  }

  space: Space | null = null;
  initSync: Promise<void> | null = null;

  private constructor(readonly uri: string, readonly layers: SyncLayer[], space?: Space) {
    this.space = space ?? null;
    this.initSync = this.startSync();
  }

  private async startSync() {
    // @TODO: refactor for the following logic:
    // First, load from local layers and after that - 
    // load from remote but using vector states we can get from trees 
    // created with ops from the local layers. It means that remote 
    // layers should reference a space so they can get trees and their vector states.

    const localLayers = this.layers.filter(layer => layer.type === 'local');
    const remoteLayers = this.layers.filter(layer => layer.type === 'remote');

    // We load from the local layers first so we can build space tree that we can use
    // later with remote layers to get ops with the help of vector states.
    // It means that if we have most of the ops locally already, the remote layers will return
    // only the remaining missing ops.
    await this.createOrUpdateSpace(localLayers);
    await this.createOrUpdateSpace(remoteLayers);
  }

  private async createOrUpdateSpace(layers: SyncLayer[]) {
    const accumulatedOps: VertexOperation[] = [];

    // We build a space this way so it can be built as fast as possible.
    // As soon as we get the first layer that has enough ops to build a space
    // we create it and can use it immidiately without waiting for all layers to load.
    await Promise.all(layers.map(async layer => {
      accumulatedOps.push(...await layer.loadSpaceTreeOps());
      if (accumulatedOps.length === 0) return;

      if (!this.space) {
        // We do it in try-catch in case if the space ops can't create a valid space. 
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
}