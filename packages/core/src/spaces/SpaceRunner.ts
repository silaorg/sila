import { RepTree, isAnyPropertyOp } from "reptree";
import type { VertexOperation } from "reptree";
import { Space } from "./Space";
import { AppTree } from "./AppTree";
import type { PersistenceLayer } from "./persistence/PersistenceLayer";
import uuid from "../utils/uuid";
import { Backend } from "./Backend";
import { AgentServices } from "../agents/AgentServices";

export type SpaceRunnerHostType = "web" | "server" | "desktop" | "mobile";

export type SpaceRunnerOptions = {
  disableBackend?: boolean;
  hostType?: SpaceRunnerHostType;
};

export type SpaceRunnerPointer = {
  id: string;
  uri: string;
};

export class SpaceRunner {
  private pointer: SpaceRunnerPointer;
  private backend: Backend | null = null;
  private agentServices: AgentServices | null = null;
  private started = false;

  constructor(
    private space: Space,
    private persistenceLayers: PersistenceLayer[],
    private options: SpaceRunnerOptions = {},
    pointer?: SpaceRunnerPointer,
  ) {
    this.pointer = pointer ?? {
      id: space.getId(),
      uri: space.getId(),
    };

    for (const layer of this.persistenceLayers) {
      if (layer.referenceSpaceRunner) {
        layer.referenceSpaceRunner(this);
      }
    }
  }

  static async createForNewSpace(
    space: Space,
    pointer: SpaceRunnerPointer,
    layers: PersistenceLayer[],
    options: SpaceRunnerOptions = {},
  ): Promise<SpaceRunner> {
    const connectedLayers: PersistenceLayer[] = [];

    // Connect all layers in parallel
    await Promise.allSettled(
      layers.map(async (layer) => {
        try {
          await layer.connect();
          connectedLayers.push(layer);
        } catch (error) {
          console.warn(`Failed to connect persistence layer ${layer.id}:`, error);
        }
      })
    );

    if (layers.length > 0 && connectedLayers.length === 0) {
      throw new Error("No persistence layers available for new space");
    }

    if (connectedLayers.length > 0) {
      const initOps = space.tree.getAllOps();
      // Save initial state to all connected layers
      await Promise.allSettled(
        connectedLayers.map(async (layer) => {
          try {
            await layer.saveTreeOps(space.getId(), initOps);
          } catch (error) {
            console.warn(`Failed to save initial ops to layer ${layer.id}:`, error);
          }
        })
      );
    }

    const runner = new SpaceRunner(space, layers, options, pointer);
    // We don't await full start/sync here for new spaces, just start it
    runner.start();
    return runner;
  }

  static async loadFromLayers(
    pointer: SpaceRunnerPointer,
    layers: PersistenceLayer[],
    options: SpaceRunnerOptions = {},
  ): Promise<{ space: Space; runner: SpaceRunner }> {
    const localLayers = layers.filter(layer => layer.type === "local");
    const remoteLayers = layers.filter(layer => layer.type === "remote");

    let space: Space | null = null;
    let loadedOps: VertexOperation[] = [];

    // 1. Try to load from local layers first (fast path)
    if (localLayers.length > 0) {
      try {
        const result = await Promise.any(
          localLayers.map(async (layer) => {
            await layer.connect();
            const ops = await layer.loadSpaceTreeOps();

            if (ops.length === 0) {
              throw new Error("No ops found");
            }

            // Validate ops by trying to build the tree
            // If this throws, Promise.any will treat it as a rejection for this layer
            new Space(new RepTree(uuid(), ops));

            return ops;
          })
        );
        loadedOps = result;
      } catch (error) {
        console.warn("Failed to load valid space from local layers, falling back to all layers", error);
      }
    }

    // 2. If no local layers or local load failed, try remote layers
    if (loadedOps.length === 0 && remoteLayers.length > 0) {
      try {
        const result = await Promise.any(
          remoteLayers.map(async (layer) => {
            // Remote layers connect on demand here
            if (!layer.isConnected()) {
              await layer.connect();
            }
            const ops = await layer.loadSpaceTreeOps();

            if (ops.length > 0) {
              // Validate ops by trying to build the tree
              new Space(new RepTree(uuid(), ops));
            } else {
              throw new Error("No ops found");
            }
            return ops;
          })
        );
        loadedOps = result;
      } catch (error) {
        // If we still have no ops and no layers worked, we can't load the space
        // But maybe it's a new empty space? Use empty ops if we have at least one connected layer?
        // For now, assume failure if we can't load any ops
        console.warn("Could not load valid ops from any layer. Starting with empty space if allowed.");
      }
    }

    if (loadedOps.length === 0) {
      throw new Error("No valid ops found in any layer");
    }

    // Create the space
    space = new Space(new RepTree(uuid(), loadedOps));

    // Create runner with ALL layers (some might be connected, some not)
    const runner = new SpaceRunner(space, layers, options, pointer);

    // Load secrets efficiently
    await runner.loadSecrets();

    // Start running (this will handle remaining connections and syncing in background)
    // We do NOT await this fully to unblock UI
    runner.start();

    return { space, runner };
  }

  private static async connectAndLoadFromLayersInternal(layers: PersistenceLayer[]) {
    // Deprecated / Unused
  }


  getSpace(): Space {
    return this.space;
  }

  getPersistenceLayers(): PersistenceLayer[] {
    return this.persistenceLayers;
  }

  getBackend(): Backend {
    if (!this.backend) {
      this.backend = new Backend(this.space);
    }
    return this.backend;
  }

  getAgentServices(): AgentServices {
    if (!this.agentServices) {
      this.agentServices = new AgentServices(this.space);
    }
    return this.agentServices;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true; // Mark as started immediately to prevent double calls

    this.attachFileStoreProvider();
    this.registerTreeLoader();
    this.setupOperationTracking();
    this.initBackend();

    // Background task: Connect to all layers, enable sync, and converge state
    this.runBackgroundSync();
  }

  private async runBackgroundSync() {
    // 1. Ensure all layers are connected
    await Promise.allSettled(
      this.persistenceLayers.map(async (layer) => {
        if (!layer.isConnected()) {
          try {
            await layer.connect();
          } catch (e) {
            console.error(`Failed to connect to layer ${layer.id}`, e);
          }
        }
      })
    );

    // 2. Setup listeners for real-time sync
    await this.setupTwoWaySync();

    // 3. Perform initial convergence (sync missing ops)
    if (this.persistenceLayers.length > 0) {
      await this.syncTreeOpsBetweenLayers(this.space.getId());
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    await Promise.all(
      this.persistenceLayers
        .filter((layer) => layer.stopListening)
        .map((layer) => layer.stopListening!()),
    );

    await Promise.all(
      this.persistenceLayers.map((layer) => layer.disconnect()),
    );
    this.started = false;
  }

  async dispose(): Promise<void> {
    await this.stop();
    this.backend = null;
    this.agentServices = null;
  }

  addPersistenceLayer(layer: PersistenceLayer): void {
    this.persistenceLayers = [...this.persistenceLayers, layer];
    this.setupOperationTrackingForLayer(layer);
    this.registerTreeLoader();
  }

  removePersistenceLayer(layerId: string): void {
    const removedLayer = this.persistenceLayers.find((layer) =>
      layer.id === layerId
    );
    this.persistenceLayers = this.persistenceLayers.filter((layer) =>
      layer.id !== layerId
    );
    if (removedLayer) {
      removedLayer.disconnect().catch(console.error);
    }
  }

  private registerTreeLoader(): void {
    if (this.persistenceLayers.length === 0) return;

    this.space.registerTreeLoader(async (appTreeId: string) => {
      const treeLoadPromises = this.persistenceLayers.map(async (layer) => {
        await layer.connect();
        const ops = await layer.loadTreeOps(appTreeId);
        return { layer, ops };
      });

      let appTree: AppTree | undefined;

      try {
        const firstTreeResult = await Promise.race(treeLoadPromises);
        if (firstTreeResult.ops.length === 0) {
          throw new Error("No app tree ops found");
        }

        const tree = new RepTree(uuid(), firstTreeResult.ops);
        if (!tree.root) {
          throw new Error("No root vertex found in app tree");
        }

        appTree = new AppTree(tree);

        Promise.allSettled(treeLoadPromises).then((results) => {
          results.forEach((result) => {
            if (
              result.status === "fulfilled" && result.value !== firstTreeResult
            ) {
              const { ops } = result.value;
              if (ops.length > 0) {
                appTree!.tree.merge(ops);
              }
            }
          });
        }).catch((error) =>
          console.error(
            "Failed to load app tree from additional layers:",
            error,
          )
        );
      } catch {
        const allOps: VertexOperation[] = [];
        const results = await Promise.allSettled(treeLoadPromises);

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            allOps.push(...result.value.ops);
          }
        });

        const tree = new RepTree(uuid(), allOps);
        if (!tree.root) {
          return undefined;
        }

        appTree = new AppTree(tree);
      }

      this.syncTreeOpsBetweenLayers(appTreeId);

      return appTree;
    });
  }

  private shouldEnableBackend(): boolean {
    if (this.options.disableBackend === true) {
      return false;
    }

    if (!this.options.hostType) {
      return false;
    }

    if (this.options.hostType === "web") {
      if (
        this.pointer.uri.startsWith("http://") ||
        this.pointer.uri.startsWith("https://")
      ) {
        return false;
      }
    }

    return true;
  }

  private initBackend() {
    if (!this.shouldEnableBackend()) {
      return;
    }

    if (!this.backend) {
      this.backend = new Backend(this.space);
    }
  }

  private attachFileStoreProvider(): void {
    if (this.space.fileStore) {
      return;
    }

    for (const layer of this.persistenceLayers) {
      if (typeof (layer as any).getFileStoreProvider === "function") {
        const provider = (layer as any).getFileStoreProvider();
        this.space.setFileStoreProvider(provider);
        return;
      }
    }
  }

  /**
   * Sync tree operations between layers. It means that layers will share missing ops between each other.
   * We need it to make sure that all layers converge to the same latest state in case if they were not saving ops at the same time.
   * @param treeId - The id of the tree to sync
   */
  private async syncTreeOpsBetweenLayers(treeId: string): Promise<void> {
    if (this.persistenceLayers.length <= 1) {
      return;
    }

    try {
      // 1. Load ops from all layers (parallel)
      // Note: Remote layers (smart sync) return only missing ops (deltas).
      // Local layers usually return all ops.
      const layerOpsPromises = this.persistenceLayers.map(async (layer) => {
        await layer.connect();
        const ops = await layer.loadTreeOps(treeId);
        return { layer, ops };
      });
      const allOpsFromLayers = await Promise.all(layerOpsPromises);

      // 2. Merge ALL discovered ops into the live Space/AppTree
      // This ensures the Space is the superset of all knowledge.
      const isSpaceTree = this.space.getId() === treeId;
      const targetTree = isSpaceTree
        ? this.space.tree
        : this.space.getAppTree(treeId)?.tree;

      const allOps = allOpsFromLayers.flatMap((r) => r.ops);
      if (allOps.length > 0 && targetTree) {
        targetTree.merge(allOps);
      }

      if (!targetTree) return;

      for (const { layer, ops } of allOpsFromLayers) {
        if (layer.type === 'remote') continue;

        // Construct a temporary tree to calculate the layer's vector efficiently
        // (Assuming local layers allow us to load everything - which they do)
        // Optimization: If ops is empty, vector is empty.
        const layerTree = new RepTree(uuid(), ops);
        const layerVector = layerTree.getStateVector();

        // Find what the Space has that this Layer lacks
        // We cast layerVector to Record<string, number[][]> as RepTree always returns a valid object
        let missingOps = targetTree.getMissingOps(layerVector as Record<string, number[][]>);

        // Filter out transient property ops (which local layers often refuse to save, causing a loop)
        missingOps = missingOps.filter(op => !isAnyPropertyOp(op) || !op.transient);

        if (missingOps.length > 0) {
          if (isSpaceTree) {
            console.log(
              `Saving missing ops for the SPACE: ${treeId} to layer: ${layer.id}`,
              missingOps.length,
              missingOps[0]
            );
          } else {
            console.log(
              `Saving missing ops for tree ${treeId} to layer: ${layer.id}`,
              missingOps.length,
              missingOps[0]
            );
          }
          await layer.saveTreeOps(treeId, missingOps);
        }
      }

    } catch (error) {
      console.error(
        `Failed to sync tree operations for treeId ${treeId}:`,
        error,
      );
    }
  }

  private setupOperationTracking(
    space: Space = this.space,
    layers: PersistenceLayer[] = this.persistenceLayers,
  ) {
    space.tree.observeOpApplied((op) => {
      if (
        op.id.peerId === space.tree.peerId &&
        !("transient" in op && op.transient)
      ) {
        Promise.all(
          layers.map((layer) => layer.saveTreeOps(space.getId(), [op])),
        )
          .catch((error) =>
            console.error("Failed to save space tree operation:", error)
          );
      }
    });

    space.observeNewAppTree((appTreeId) => {
      const appTree = space.getAppTree(appTreeId)!;
      const ops = appTree.tree.getAllOps();

      Promise.all(layers.map((layer) => layer.saveTreeOps(appTreeId, ops)))
        .catch((error) =>
          console.error("Failed to save new app tree ops:", error)
        );

      appTree.tree.observeOpApplied((op) => {
        if (
          op.id.peerId === appTree.tree.peerId &&
          !("transient" in op && op.transient)
        ) {
          Promise.all(layers.map((layer) => layer.saveTreeOps(appTreeId, [op])))
            .catch((error) =>
              console.error("Failed to save app tree operation:", error)
            );
        }
      });
    });

    space.observeTreeLoad((appTreeId) => {
      const appTree = space.getAppTree(appTreeId)!;
      appTree.tree.observeOpApplied((op) => {
        if (
          op.id.peerId === appTree.tree.peerId &&
          !("transient" in op && op.transient)
        ) {
          Promise.all(layers.map((layer) => layer.saveTreeOps(appTreeId, [op])))
            .catch((error) =>
              console.error("Failed to save loaded app tree operation:", error)
            );
        }
      });
    });

    this.wrapSecretsMethod(space, layers);
  }

  private setupOperationTrackingForLayer(layer: PersistenceLayer) {
    this.setupOperationTracking(this.space, [layer]);
  }

  private async setupTwoWaySync(
    space: Space = this.space,
    layers: PersistenceLayer[] = this.persistenceLayers,
  ) {
    const spaceId = space.getId();

    for (const layer of layers) {
      if (layer.startListening) {
        await layer.startListening((treeId, incomingOps) => {
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
      Promise.all(layers.map((layer) => layer.saveSecrets({ [key]: value })))
        .catch((error) => console.error("Failed to save secret:", error));
    };

    space.saveAllSecrets = (secrets: Record<string, string>) => {
      originalSaveAllSecrets(secrets);
      Promise.all(layers.map((layer) => layer.saveSecrets(secrets)))
        .catch((error) => console.error("Failed to save secrets:", error));
    };
  }

  private async loadSecrets(): Promise<void> {
    if (this.persistenceLayers.length === 0) {
      return;
    }

    const secretPromises = this.persistenceLayers.map(async (layer) => {
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
      const secretResults = (await Promise.all(secretPromises)).filter(
        (
          result,
        ): result is {
          layer: PersistenceLayer;
          secrets: Record<string, string> | undefined;
        } => result !== null,
      );
      const firstSecretsResult = secretResults.find((result) =>
        result.secrets && Object.keys(result.secrets).length > 0
      ) ??
        secretResults[0];

      if (
        firstSecretsResult?.secrets &&
        Object.keys(firstSecretsResult.secrets).length > 0
      ) {
        this.space.saveAllSecrets(firstSecretsResult.secrets);
      }

      const additionalSecrets: Record<string, string> = {};
      secretResults.forEach((result) => {
        if (result !== firstSecretsResult && result.secrets) {
          Object.assign(additionalSecrets, result.secrets);
        }
      });
      if (Object.keys(additionalSecrets).length > 0) {
        this.space.saveAllSecrets(additionalSecrets);
      }
    } catch (error) {
      console.error("Failed to load secrets from any layer:", error);
    }
  }
}
