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
    // We do accumulation of ops here just in case if we couldn't build a valid space from a set of ops from a layer.
    // We would carry those incomplete ops over to an iteration with another layer to build a space with.
    // The case with a layer not holding a valid set of ops to build a space is not desirable but possible
    // by the design of the sync layers. Which is fine.
    const accumulatedOps: VertexOperation[] = [];

    const layersToSetupOpsTracking: SyncLayer[] = [];

    // We're trying to build a space as soon as possible without waiting for
    // ops from all of the layers. As soon as we get a layer that has enough
    // ops to build a space, we create it and can use it immidiately.
    await Promise.all(layers.map(async layer => {
      layersToSetupOpsTracking.push(layer);
      accumulatedOps.push(...await layer.loadSpaceTreeOps());
      if (accumulatedOps.length === 0) return;

      if (!this.space) {
        // We do it in try-catch in case if the space ops can't create a valid space. 
        // We will carry the ops we accumulated to the next cycle if space creation fails.
        try {
          const space = Space.existingSpaceFromOps(accumulatedOps);
          accumulatedOps.length = 0;
          this.space = space;

          this.trackOps(layersToSetupOpsTracking);
          layersToSetupOpsTracking.length = 0;
        } catch (e) {
          return;
        }
      }

      this.space.tree.merge(accumulatedOps);
      accumulatedOps.length = 0;

      this.trackOps(layersToSetupOpsTracking);
      layersToSetupOpsTracking.length = 0;
    }));
  }

  private async trackOps(layers: SyncLayer[]) {
    const space = this.space;

    if (!space) {
      throw new Error(`Space is not initialized`);
    }

    for (const layer of layers) {
      space.tree.observeOpApplied((op) => {
        if (
          op.id.peerId === space.tree.peerId &&
          !("transient" in op && op.transient)
        ) {
          layer.saveTreeOps(space.id, [op]).catch((error) => {
            console.error("Failed to save space tree operation:", error);
          });
        }
      });
    }
  }
}