import { RepTree, isAnyPropertyOp } from "reptree";
import type { VertexOperation } from "reptree";
import { Space } from "./Space";
import { AppTree } from "./AppTree";
import type { PersistenceLayer } from "./persistence/PersistenceLayer";
import uuid from "../utils/uuid";

export interface SpacePointer {
  id: string;
  uri: string;
  name: string | null;
  createdAt: Date;
  userId: string | null;
}

export interface SpaceConfig {
  persistenceLayers?: PersistenceLayer[];
}

/**
 * Manages spaces and their persistence layers.
 * Handles loading, saving, and orchestrating multiple persistence strategies.
 */
export class SpaceManager {
  private spaces = new Map<string, Space>();
  // @TODO: refactor to put layers in 'spaces' map
  private spaceLayers = new Map<string, PersistenceLayer[]>();

  private registerTreeLoader(space: Space, persistenceLayers: PersistenceLayer[]) {
    if (persistenceLayers.length === 0) return;

    // Register tree loader that uses race-based loading
    space.registerTreeLoader(async (appTreeId: string) => {
      const treeLoadPromises = persistenceLayers.map(async (layer) => {
        await layer.connect();
        const ops = await layer.loadTreeOps(appTreeId);
        return { layer, ops };
      });

      let appTree: AppTree | undefined;

      try {
        // Use the first layer that successfully loads the app tree
        const firstTreeResult = await Promise.race(treeLoadPromises);
        if (firstTreeResult.ops.length === 0) {
          throw new Error("No app tree ops found");
        }

        const tree = new RepTree(uuid(), firstTreeResult.ops);
        // @NOTE: would make sense to check if the tree has a valid structure for an app tree
        if (!tree.root) {
          throw new Error("No root vertex found in app tree");
        }

        appTree = new AppTree(tree);

        // Continue with remaining layers as they complete
        Promise.allSettled(treeLoadPromises).then(results => {
          results.forEach(result => {
            if (result.status === 'fulfilled' && result.value !== firstTreeResult) {
              const { ops } = result.value;
              if (ops.length > 0) {
                appTree!.tree.merge(ops);
              }
            }
          });
        }).catch(error => console.error('Failed to load app tree from additional layers:', error));
      } catch {
        // Try to get ops from all layers
        const allOps: VertexOperation[] = [];
        const results = await Promise.allSettled(treeLoadPromises);

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            allOps.push(...result.value.ops);
          }
        });

        const tree = new RepTree(uuid(), allOps);
        if (!tree.root) {
          return undefined;
        }

        appTree = new AppTree(tree);
      }

      // Sync the app tree ops between layers in case if they have different ops
      this.syncTreeOpsBetweenLayers(appTreeId, persistenceLayers);

      return appTree;
    });
  }

  private getFulfilledResults<T>(results: PromiseSettledResult<T>[]): T[] {
    return results
      .filter((result): result is PromiseFulfilledResult<T> => result.status === "fulfilled")
      .map((result) => result.value);
  }

  private attachFileStoreProvider(space: Space, layers: PersistenceLayer[]) {
    if (space.fileStore) {
      return;
    }

    for (const layer of layers) {
      if (typeof (layer as any).getFileStoreProvider === "function") {
        const provider = (layer as any).getFileStoreProvider();
        space.setFileStoreProvider(provider);
        return;
      }
    }
  }

  /**
   * Add a new space to the manager. Saves the space to the persistence layers.
   * @param space - The space to add
   * @param persistenceLayers - The persistence layers to use for the space
   */
  async addNewSpace(
    space: Space,
    persistenceLayers: PersistenceLayer[],
    spaceKey?: string,
  ): Promise<void> {
    const spaceId = space.getId();
    const key = spaceKey ?? spaceId;

    if (persistenceLayers.length > 0) {
      const connectedLayers = (
        await Promise.allSettled(
          persistenceLayers.map(async (layer) => {
            await layer.connect();
            return layer;
          })
        )
      )
        .filter((result) => {
          if (result.status === "rejected") {
            console.warn("Failed to connect persistence layer:", result.reason);
            return false;
          }
          return true;
        })
        .map((result) => (result as PromiseFulfilledResult<PersistenceLayer>).value);

      if (connectedLayers.length === 0) {
        throw new Error("No persistence layers available for new space");
      }

      // Register tree loader so this space can lazily load AppTrees (incl. ones created by other peers)
      this.registerTreeLoader(space, connectedLayers);

      // Save initial operations to all layers
      const initOps = space.tree.getAllOps();
      const savedLayers = (
        await Promise.allSettled(
          connectedLayers.map(async (layer) => {
            await layer.saveTreeOps(spaceId, initOps);
            return layer;
          })
        )
      )
        .filter((result) => {
          if (result.status === "rejected") {
            console.warn("Failed to save initial ops to layer:", result.reason);
            return false;
          }
          return true;
        })
        .map((result) => (result as PromiseFulfilledResult<PersistenceLayer>).value);

      if (savedLayers.length === 0) {
        throw new Error("Failed to initialize persistence layers for new space");
      }

      // Attach FileStore provider if available on a filesystem layer
      for (const layer of savedLayers) {
        if (typeof (layer as any).getFileStoreProvider === 'function') {
          const provider = (layer as any).getFileStoreProvider();
          space.setFileStoreProvider(provider);
          break;
        }
      }

      // Set up operation tracking and sync
      this.setupOperationTracking(space, savedLayers);
      await this.setupTwoWaySync(space, savedLayers);

      this.spaceLayers.set(key, savedLayers);
    }

    this.spaces.set(key, space);
  }

  /**
   * Load an existing space from persistence layers.
   * Will return space as soon as it loads from the fastest layer
   * and merge in the ops from the other layers as they load.
   * @param pointer - The pointer to the space
   * @param persistenceLayers - The persistence layers to use for the space
   */
  async loadSpace(pointer: SpacePointer, persistenceLayers: PersistenceLayer[]): Promise<Space> {
    const spaceId = pointer.id;
    const key = pointer.uri;

    // Check if already loaded
    const existingSpace = this.spaces.get(key);
    if (existingSpace) {
      return existingSpace;
    }

    // Start connecting all layers in parallel and load ops
    const layerPromises = persistenceLayers.map(async (layer) => {
      await layer.connect();
      const ops = await layer.loadSpaceTreeOps();
      return { layer, ops };
    });
    const layerResultsPromise = Promise.allSettled(layerPromises);

    let space: Space | null = null;
    let firstResult: { layer: PersistenceLayer; ops: VertexOperation[] } | null = null;
    let availableResults: { layer: PersistenceLayer; ops: VertexOperation[] }[] = [];
    try {
      // Use the first layer that successfully loads
      // One layer is enough to construct the space
      firstResult = await Promise.any(layerPromises);

      space = new Space(new RepTree(uuid(), firstResult.ops));
    } catch (error) {
      console.error('Failed to load space tree from any layer:', error);
      console.log('As a fallback, will try to load from all layers');
    }

    const settledResults = await layerResultsPromise;
    availableResults = this.getFulfilledResults(settledResults);

    if (availableResults.length === 0) {
      throw new Error("No persistence layers available to load space");
    }

    const availableLayers = availableResults.map((result) => result.layer);

    if (!space) {
      const allOps: VertexOperation[] = [];
      availableResults.forEach(result => {
        allOps.push(...result.ops);
      });

      space = new Space(new RepTree(uuid(), allOps));
    }

    this.attachFileStoreProvider(space, [
      ...(firstResult ? [firstResult.layer] : []),
      ...availableLayers
    ]);

    availableResults.forEach((result) => {
      if (result !== firstResult && result.ops.length > 0) {
        space!.tree.merge(result.ops);
      }
    });

    // Sync the space tree ops between layers in case if they have different ops
    this.syncTreeOpsBetweenLayers(space.getId(), availableLayers);

    this.registerTreeLoader(space, availableLayers);

    // Load secrets using race-based approach
    const secretPromises = availableLayers.map(async (layer) => {
      try {
        await layer.connect();
        const secrets = await layer.loadSecrets();
        return { layer, secrets };
      } catch (error) {
        console.warn("Failed to load secrets from layer:", error);
        return null;
      }
    });

    try {
      // Use the first layer that successfully loads secrets
      const secretResults = (await Promise.all(secretPromises)).filter(
        (result): result is { layer: PersistenceLayer; secrets: Record<string, string> | undefined } =>
          result !== null
      );
      const firstSecretsResult =
        secretResults.find((result) => result.secrets && Object.keys(result.secrets).length > 0) ??
        secretResults[0];

      if (firstSecretsResult?.secrets && Object.keys(firstSecretsResult.secrets).length > 0) {
        space.saveAllSecrets(firstSecretsResult.secrets);
      }

      const additionalSecrets: Record<string, string> = {};
      secretResults.forEach((result) => {
        if (result !== firstSecretsResult && result.secrets) {
          Object.assign(additionalSecrets, result.secrets);
        }
      });
      if (Object.keys(additionalSecrets).length > 0) {
        space.saveAllSecrets(additionalSecrets);
      }
    } catch (error) {
      console.error('Failed to load secrets from any layer:', error);
    }

    // Set up operation tracking to save to all layers
    this.setupOperationTracking(space, availableLayers);

    // Set up two-way sync for layers that support it
    await this.setupTwoWaySync(space, availableLayers);

    this.spaceLayers.set(key, availableLayers);
    this.spaces.set(key, space);

    return space;
  }

  /**
   * Sync tree operations between layers. It means that layers will share missing ops between each other.
   * We need it to make sure that all layers converge to the same latest state in case if they were not saving ops at the same time.
   * @param treeId - The id of the tree to sync
   * @param layers - The layers to sync the tree between
   */
  async syncTreeOpsBetweenLayers(treeId: string, layers: PersistenceLayer[]): Promise<void> {
    if (layers.length <= 1) {
      return; // No need to sync if there's only one layer
    }

    try {
      // Load operations from all layers
      const layerOpsPromises = layers.map(async (layer) => {
        await layer.connect();
        const ops = await layer.loadTreeOps(treeId);
        return { layer, ops };
      });
      const allOpsFromLayers = await Promise.all(layerOpsPromises);

      // For each layer, find missing ops by looking at all other layers' ops
      for (const { layer, ops } of allOpsFromLayers) {
        // Set of all ops from this layer. We will use it to find missing ops quickly
        const opsIdSet = new Set<string>();
        // Optimized: Map of latest property ops for this layer
        const latestPropOps = new Map<string, VertexOperation>();

        for (const op of ops) {
          opsIdSet.add(`${op.id.counter}@${op.id.peerId}`);

          if (isAnyPropertyOp(op)) {
            const key = `${op.targetId}:${op.key}`;
            const existing = latestPropOps.get(key);

            // Keep the "winner" (LWW: higher counter, or same counter + higher peerId)
            if (!existing ||
                op.id.counter > existing.id.counter ||
                (op.id.counter === existing.id.counter && op.id.peerId > existing.id.peerId)) {
              latestPropOps.set(key, op);
            }
          }
        }

        const missingOps: VertexOperation[] = [];

        for (const { layer: layerB, ops: opsB } of allOpsFromLayers) {
          if (layer === layerB) {
            continue;
          }

          for (const opB of opsB) {
            const opBId = `${opB.id.counter}@${opB.id.peerId}`;
            if (!opsIdSet.has(opBId)) {
              // Check if we should skip this op because it's a property op and we already have a newer version
              if (isAnyPropertyOp(opB)) {
                const key = `${opB.targetId}:${opB.key}`;
                const existingOp = latestPropOps.get(key);

                if (existingOp) {
                  // existingOp is the latest we have.
                  // If existingOp >= opB, then opB is redundant (it's older or "smaller").
                  if (existingOp.id.counter > opB.id.counter ||
                      (existingOp.id.counter === opB.id.counter && existingOp.id.peerId > opB.id.peerId)) {
                    continue;
                  }
                }
              }

              missingOps.push(opB);
              opsIdSet.add(opBId);
            }
          }
        }

        if (missingOps.length > 0) {
          const isSpaceTree = Array.from(this.spaces.values()).some(
            (space) => space.getId() === treeId,
          );
          if (isSpaceTree) {
            console.log(`Saving missing ops for the SPACE: ${treeId} to layer: ${layer.id}`, missingOps);
          } else {
            console.log(`Saving missing ops for tree ${treeId} to layer: ${layer.id}`, missingOps);
          }

          await layer.saveTreeOps(treeId, missingOps);
        }
      }
    } catch (error) {
      console.error(`Failed to sync tree operations for treeId ${treeId}:`, error);
    }
  }

  /**
   * Close a space and disconnect its persistence layers
   */
  async closeSpace(spaceKey: string): Promise<void> {
    const layers = this.spaceLayers.get(spaceKey);
    if (layers) {
      // Stop listening on two-way sync layers
      await Promise.all(
        layers
          .filter(layer => layer.stopListening)
          .map(layer => layer.stopListening!())
      );

      // Disconnect all layers
      await Promise.all(layers.map(layer => layer.disconnect()));

      this.spaceLayers.delete(spaceKey);
    }

    this.spaces.delete(spaceKey);
  }

  /**
   * Get all active spaces
   */
  getActiveSpaces(): Space[] {
    return Array.from(this.spaces.values());
  }

  /**
   * Get a specific space by ID
   */
  getSpace(spaceKey: string): Space | undefined {
    return this.spaces.get(spaceKey);
  }

  getPersistenceLayers(spaceKey: string): PersistenceLayer[] | undefined {
    return this.spaceLayers.get(spaceKey);
  }

  /**
   * Add a persistence layer to an existing space
   */
  addPersistenceLayer(spaceKey: string, layer: PersistenceLayer): void {
    const existingLayers = this.spaceLayers.get(spaceKey) || [];
    const space = this.spaces.get(spaceKey);

    if (space) {
      const newLayers = [...existingLayers, layer];
      this.spaceLayers.set(spaceKey, newLayers);

      // Set up tracking for the new layer
      this.setupOperationTracking(space, [layer]);

      // Update tree loader to include the new layer
      this.registerTreeLoader(space, newLayers);
    }
  }

  /**
   * Remove a persistence layer from a space
   */
  removePersistenceLayer(spaceKey: string, layerId: string): void {
    const layers = this.spaceLayers.get(spaceKey);
    if (layers) {
      const updatedLayers = layers.filter(layer => layer.id !== layerId);
      this.spaceLayers.set(spaceKey, updatedLayers);

      // Disconnect the removed layer
      const removedLayer = layers.find(layer => layer.id === layerId);
      if (removedLayer) {
        removedLayer.disconnect().catch(console.error);
      }
    }
  }

  private setupOperationTracking(space: Space, layers: PersistenceLayer[]) {
    // Track main space tree ops
    space.tree.observeOpApplied((op) => {
      if (op.id.peerId === space.tree.peerId && !('transient' in op && op.transient)) {
        // Save to all layers in parallel
        Promise.all(layers.map(layer => layer.saveTreeOps(space.getId(), [op])))
          .catch(error => console.error('Failed to save space tree operation:', error));
      }
    });

    // Track new AppTree creation
    space.observeNewAppTree((appTreeId) => {
      const appTree = space.getAppTree(appTreeId)!;
      const ops = appTree.tree.getAllOps();

      // Save initial ops to all layers
      Promise.all(layers.map(layer => layer.saveTreeOps(appTreeId, ops)))
        .catch(error => console.error('Failed to save new app tree ops:', error));

      // Track future ops on this AppTree
      appTree.tree.observeOpApplied((op) => {
        if (op.id.peerId === appTree.tree.peerId && !('transient' in op && op.transient)) {
          Promise.all(layers.map(layer => layer.saveTreeOps(appTreeId, [op])))
            .catch(error => console.error('Failed to save app tree operation:', error));
        }
      });
    });

    // Track loaded AppTree operations
    space.observeTreeLoad((appTreeId) => {
      const appTree = space.getAppTree(appTreeId)!;
      appTree.tree.observeOpApplied((op) => {
        if (op.id.peerId === appTree.tree.peerId && !('transient' in op && op.transient)) {
          Promise.all(layers.map(layer => layer.saveTreeOps(appTreeId, [op])))
            .catch(error => console.error('Failed to save loaded app tree operation:', error));
        }
      });
    });

    // Track secrets changes
    this.wrapSecretsMethod(space, layers);
  }

  private setupOperationTrackingForLayer(space: Space, layer: PersistenceLayer) {
    // This is a simplified version for adding a single layer
    // In a full implementation, we'd need to avoid duplicate tracking
    this.setupOperationTracking(space, [layer]);
  }

  private async setupTwoWaySync(space: Space, layers: PersistenceLayer[]) {
    const spaceId = space.getId();

    for (const layer of layers) {
      if (layer.startListening) {
        await layer.startListening((treeId, incomingOps) => {
          // Apply incoming operations to the appropriate tree
          if (treeId === spaceId) {
            space.tree.merge(incomingOps);
          } else {
            const appTree = space.getAppTree(treeId);
            if (appTree) {
              appTree.tree.merge(incomingOps);
            }
          }
        });
      }
    }
  }

  private wrapSecretsMethod(space: Space, layers: PersistenceLayer[]) {
    const originalSetSecret = space.setSecret.bind(space);
    const originalSaveAllSecrets = space.saveAllSecrets.bind(space);

    space.setSecret = (key: string, value: string) => {
      originalSetSecret(key, value);
      // Save to all layers in parallel
      Promise.all(layers.map(layer => layer.saveSecrets({ [key]: value })))
        .catch(error => console.error('Failed to save secret:', error));
    };

    space.saveAllSecrets = (secrets: Record<string, string>) => {
      originalSaveAllSecrets(secrets);
      // Save to all layers in parallel
      Promise.all(layers.map(layer => layer.saveSecrets(secrets)))
        .catch(error => console.error('Failed to save secrets:', error));
    };
  }
} 
