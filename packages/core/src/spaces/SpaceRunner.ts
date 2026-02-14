import { SyncLayer, VertexOperation } from "@sila/core";
import { RepTree } from "reptree";
import { AppTree } from "./AppTree";
import uuid from "../utils/uuid";
import { Space } from "./Space";
import type { FileLayer } from "./files/FileLayer";

/**
 * Runs a space in memory and syncs them between peers with the help of sync layers.
 * It's used by SpaceManager where SpaceManager creates instances of SpaceRunner
 * for each space.
 */
export class SpaceRunner {

  /**
   * Create a new space runner from an existing space that we have in memory
   * @param space 
   * @param uri 
   * @param layers 
   * @param fileLayer 
   */
  static async fromExistingSpace(space: Space, uri: string, layers: SyncLayer[], fileLayer?: FileLayer): Promise<SpaceRunner> {
    const runner = new SpaceRunner(uri, layers, space, fileLayer);
    await runner.init();
    return runner;
  }

  /**
   * Create a new space runner from a URI. This will load the space from the layers.
   * @param uri 
   * @param layers 
   * @param fileLayer 
   */
  static fromURI(uri: string, layers: SyncLayer[], fileLayer?: FileLayer): SpaceRunner {
    return new SpaceRunner(uri, layers, undefined, fileLayer);
  }

  space: Space | null = null;
  private loadingSpacePromise: Promise<Space> | null = null;
  private syncStarted = false;
  private initializationComplete = false;  // Tracks when secrets and file store are ready
  private runningSpaceHandlers = new Set<() => void>();

  private constructor(readonly uri: string, readonly layers: SyncLayer[], space?: Space, private readonly fileLayer?: FileLayer) {
    this.space = space ?? null;
  }

  async init() {
    // If we already have a space, start syncing immediately to set up tracking
    if (this.space) {
      this.syncStarted = true;
      await this.startSync();
    }
  }

  async dispose() {
    // Dispose all layers
    await Promise.all(this.layers.map(async layer => {
      if (layer.disconnect) {
        try {
          await layer.disconnect();
        } catch (e) {
          console.error(`Failed to disconnect layer ${layer.id}`, e);
        }
      }
      if (layer.dispose) {
        try {
          await layer.dispose();
        } catch (e) {
          console.error(`Failed to dispose layer ${layer.id}`, e);
        }
      }
    }));
  }

  /**
   * Load the space and wait for it to be ready.
   * If the space is already loaded, returns it immediately.
   * If the space is currently loading, waits for the existing load to complete.
   * @param timeoutMs Maximum time to wait for space to load (default: 10000ms)
   * @returns The loaded space
   * @throws Error if space fails to load within timeout
   */
  async loadSpace(timeoutMs = 10000): Promise<Space> {
    // If already loaded, return immediately
    if (this.space && this.initializationComplete) {
      return this.space;
    }

    // If currently loading, return the existing promise
    if (this.loadingSpacePromise) {
      return this.loadingSpacePromise;
    }

    // Start syncing if not already started
    if (!this.syncStarted) {
      this.syncStarted = true;
      this.startSync().catch((error) => {
        console.error(`Status sync failed for space ${this.uri}`, error);
        // We could also set a failed state here to stop polling eagerly
      }); // Fire and forget - polling will check this.space
    }

    // Start loading with polling and timeout
    this.loadingSpacePromise = new Promise<Space>((resolve, reject) => {
      const startTime = performance.now();

      const checkSpace = () => {
        if (this.space && this.initializationComplete) {
          resolve(this.space);
          return;
        }

        if (performance.now() - startTime > timeoutMs) {
          reject(new Error(`Failed to load space within ${timeoutMs}ms`));
          return;
        }

        setTimeout(checkSpace, 3);
      };

      checkSpace();
    });

    try {
      const space = await this.loadingSpacePromise;
      return space;
    } finally {
      this.loadingSpacePromise = null;
    }
  }

  /**
   * Discover the space ID from the layers.
   * Returns the first available space ID from any layer.
   * @returns The space ID if found, null if no space exists yet (new space scenario)
   */
  private async fetchSpaceId(): Promise<string | null> {
    const layersWithGetSpaceId = this.layers.filter(layer => layer.getSpaceId);

    if (layersWithGetSpaceId.length === 0) {
      return null;
    }

    try {
      // Promise.any returns the first fulfilled promise
      const spaceId = await Promise.any(
        layersWithGetSpaceId.map(layer => layer.getSpaceId!())
      );
      return spaceId || null;
    } catch {
      // All layers rejected or returned undefined - this is a new space
      return null;
    }
  }

  private setupTreeLoader() {
    if (!this.space) {
      throw new Error(`Space is not initialized`);
    }

    this.space.setTreeLoader((treeId) => {
      return this.loadTree(treeId);
    });
  }

  private async loadTree(treeId: string): Promise<AppTree | undefined> {
    // We load ops from all layers. The tree is resolved as soon as the first layer
    // provides enough ops to build a valid tree. However, we continue loading
    // from other layers in the background to merge their ops into the resolved tree.
    return new Promise<AppTree | undefined>((resolve) => {
      const accumulatedOps: VertexOperation[] = [];
      let appTree: AppTree | undefined;

      const tryCreateTree = () => {
        try {
          // Attempt to create a valid tree from accumulated ops.
          // If the ops are insufficient or invalid, RepTree/AppTree throws.
          const tree = new RepTree(uuid(), accumulatedOps);
          appTree = new AppTree(tree);
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
        // resolve with undefined.
        if (!appTree) {
          resolve(undefined);
          return;
        }

        // Sync ops back to layers that don't have all ops
        for (const layer of this.layers) {
          if (layer.uploadMissingFromTree) layer.uploadMissingFromTree(appTree.tree);
        }
      });
    });
  }

  private async startSync() {
    // If we already have a space (fromExistingSpace), save its initial ops and set up tracking
    if (this.space) {
      // Connect all layers first
      await Promise.all(this.layers.map(layer =>
        layer.connect?.().catch(e =>
          console.error(`Failed to connect layer ${layer.id}`, e)
        )
      ));

      this.setupTreeLoader();
      this.trackOps(this.layers);

      // Save initial space operations to all layers
      const initialOps = this.space.tree.getAllOps() as VertexOperation[];
      await Promise.all(this.layers.map(layer =>
        layer.saveTreeOps(this.space!.id, initialOps).catch(e =>
          console.error(`Failed to save initial space ops to layer ${layer.id}`, e)
        )
      ));

      await this.loadSecrets();
      this.initializationComplete = true;
      return;
    }

    const startLoadingSpaceTime = performance.now();

    // Discover the space ID from layers
    const spaceId = await this.fetchSpaceId();

    if (!spaceId) {
      // No space exists yet - new spaces must be created via Space.newSpace() and addSpace()
      throw new Error('No existing space found. Create a space first using Space.newSpace() and addSpace()');
    }

    // Race all layers to load space as quickly as possible  
    // We accumulate ops and create space as soon as we have enough for a valid structure
    const accumulatedOps: VertexOperation[] = [];
    const layersToTrack: SyncLayer[] = [];

    await Promise.all(this.layers.map(async layer => {
      try {
        await layer.connect?.();
      } catch (e) {
        console.error(`Failed to connect layer ${layer.id}`, e);
        // Continue even if connection fails, maybe other layers work
      }

      layersToTrack.push(layer);

      let ops: VertexOperation[];
      try {
        ops = await layer.loadTreeOps(spaceId);
      } catch (e) {
        console.error(`Failed to load tree ops from layer ${layer.id}`, e);
        return;
      }

      accumulatedOps.push(...ops);
      if (accumulatedOps.length === 0) return;

      // Try to create space if we don't have one yet
      if (!this.space) {
        try {
          this.space = Space.existingSpaceFromOps(accumulatedOps);
          accumulatedOps.length = 0;

          console.log(`⏱️ Space ${this.space.id} loaded in ${performance.now() - startLoadingSpaceTime}ms; from layer: ${layer.id}`);

          this.setupTreeLoader();
          this.trackOps(layersToTrack);



          await this.loadSecrets();
          this.initializationComplete = true;

          // Sync ops back to layers that don't have all ops
          for (const layer of this.layers) {
            if (layer.uploadMissingFromTree) layer.uploadMissingFromTree(this.space.tree);
          }

          layersToTrack.length = 0;
        } catch (e) {
          // Not enough ops yet, continue accumulating
          return;
        }
      } else {
        // Space exists, merge additional ops
        this.space.tree.merge(accumulatedOps);
        accumulatedOps.length = 0;

        this.trackOps(layersToTrack);
        layersToTrack.length = 0;
      }
    }));

    if (!this.space) {
      throw new Error(`Failed to create space from ${accumulatedOps.length} accumulated ops`);
    }
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

    this.wrapSecretsMethod(this.space!, layers);
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

  private wrapSecretsMethod(space: Space, layers: SyncLayer[]) {
    // Intercept secret changes to persist them to all layers
    const originalSetSecret = space.setSecret.bind(space);
    const originalSaveAllSecrets = space.saveAllSecrets.bind(space);

    space.setSecret = (key: string, value: string) => {
      originalSetSecret(key, value);
      layers.forEach(l => l.saveSecrets?.({ [key]: value }));
    };

    space.saveAllSecrets = (secrets: Record<string, string>) => {
      originalSaveAllSecrets(secrets);
      layers.forEach(l => l.saveSecrets?.(secrets));
    };
  }

  private async loadSecrets(): Promise<void> {
    if (this.layers.length === 0) return;

    try {
      const results = await Promise.all(this.layers.map(l => l.loadSecrets?.()));
      const secrets = Object.assign({}, ...results); // Merge all loaded secrets

      if (Object.keys(secrets).length > 0) {
        this.space!.saveAllSecrets(secrets);
      }
    } catch (error) {
      console.error("Failed to load secrets:", error);
    } finally {
      this.attachFileStoreProvider();
    }
  }

  private attachFileStoreProvider(): void {
    if (this.space!.fileStore) {
      return;
    }

    // Use dedicated file layer if provided
    if (this.fileLayer) {
      const provider = this.fileLayer.getFileStoreProvider();
      this.space!.setFileStoreProvider(provider);
    }
  }
}