import { SyncLayer, VertexOperation } from "@sila/core";
import { RepTree } from "reptree";
import { AppTree } from "./AppTree";
import uuid from "../utils/uuid";
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

  private setupTreeLoader() {
    if (!this.space) {
      throw new Error(`Space is not initialized`);
    }

    this.space.setTreeLoader((treeId) => {
      // We load ops from all layers. The tree is resolved as soon as the first layer
      // provides enough ops to build a valid tree. However, we continue loading
      // from other layers in the background to merge their ops into the resolved tree.
      return new Promise<AppTree | undefined>((resolve) => {
        const accumulatedOps: VertexOperation[] = [];
        let appTree: AppTree | undefined;
        let isResolved = false;

        const tryCreateTree = () => {
          try {
            // Attempt to create a valid tree from accumulated ops.
            // If the ops are insufficient or invalid, RepTree/AppTree throws.
            const tree = new RepTree(uuid(), accumulatedOps);
            appTree = new AppTree(tree);
            isResolved = true;
            resolve(appTree);
          } catch {
            // Ops not sufficient yet, wait for more from other layers
          }
        };

        const loadLayer = async (layer: SyncLayer) => {
          try {
            const ops = await layer.loadTreeOps(treeId);
            if (ops.length === 0) return;

            accumulatedOps.push(...ops);

            // If we already have a resolved tree (from another faster layer),
            // just merge these new ops into it.
            if (appTree) {
              appTree.tree.merge(ops);
            } else {
              // Otherwise, this layer might provide the missing pieces (or be the first one).
              tryCreateTree();
            }
          } catch (e) {
            console.error(`Failed to load tree ops from layer ${layer.id}`, e);
          }
        };

        const allLayersPromise = Promise.allSettled(this.layers.map(loadLayer));

        allLayersPromise.then(() => {
          // If all layers finished and we still couldn't create a valid tree,
          // resolve with undefined (or let the caller handle the missing tree).
          if (!isResolved) resolve(undefined);
        });
      });
    });
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
    // We accumulate ops here in case if we couldn't build a valid space from a set of ops from a layer.
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
      try {
        accumulatedOps.push(...await layer.loadSpaceTreeOps());
      } catch (e) {
        console.error(`Failed to load space ops from layer ${layer.id}`, e);
        // If loading fails, we remove it from tracking for now, or maybe we should keep it?
        // For now, let's keep it in tracking list as it might recover for saving?
        // But preventing the whole process from crashing is the main goal.
        return;
      }

      if (accumulatedOps.length === 0) return;

      if (!this.space) {
        // We do it in try-catch in case if the space ops can't create a valid space. 
        // We will carry the ops we accumulated to the next cycle if space creation fails.
        try {
          const space = Space.existingSpaceFromOps(accumulatedOps);
          accumulatedOps.length = 0;
          this.space = space;

          this.setupTreeLoader();

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

    // We should only call the method after we have a space ready
    if (!space) {
      throw new Error(`Space is not initialized`);
    }

    for (const layer of layers) {
      this.trackInOps(layer);
      this.trackOutOps(layer);
    }
  }

  private async trackInOps(layer: SyncLayer) {
    const space = this.space!;

    // Ops from the space's root tree
    space.tree.observeOpApplied((op) => {
      this.saveOpsToLayer(layer, space.id, [op]);
    });

    space.onNewAppTree((appTreeId) => {
      // We send the existing ops to the layer only when we create it
      const appTree = space.getAppTree(appTreeId)!;
      this.saveOpsToLayer(layer, appTreeId, appTree.tree.getAllOps() as VertexOperation[]);
    });

    space.onTreeLoad((appTreeId) => {
      const appTree = space.getAppTree(appTreeId)!;

      // And then observe any new incoming ops
      appTree.tree.observeOpApplied((op) => {
        this.saveOpsToLayer(layer, appTreeId, [op]);
      });
    });
  }

  private saveOpsToLayer(layer: SyncLayer, treeId: string, ops: VertexOperation[]) {
    for (const op of ops) {
      // We save only ops from the current peer
      // @TODO: consider having "isBroadcasting" for a layer and if it's true, we don't need to check peerId
      // This is a way to send ops from a server to clients
      if (op.id.peerId !== this.space!.tree.peerId) continue;

      layer.saveTreeOps(treeId, [op]).catch((error) => {
        console.error("Failed to save tree operation:", error);
      });
    }

  }

  private async trackOutOps(layer: SyncLayer) {
    if (!layer.startListening) return;

    const space = this.space!;

    await layer.startListening((treeId, incomingOps) => {
      space.addTreeOps(treeId, incomingOps);
    });
  }

}