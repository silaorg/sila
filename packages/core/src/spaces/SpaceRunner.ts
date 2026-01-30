import { RepTree } from "reptree";
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
  resolvePersistenceLayers?: (
    pointer: SpaceRunnerPointer,
    hostType: SpaceRunnerHostType | undefined,
  ) => PersistenceLayer[];
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
  }

  static async createForNewSpace(
    space: Space,
    pointer: SpaceRunnerPointer,
    layers: PersistenceLayer[],
    options: SpaceRunnerOptions = {},
  ): Promise<SpaceRunner> {
    const resolvedLayers = this.resolveLayers(pointer, layers, options);
    const connectedLayers = (
      await Promise.allSettled(
        resolvedLayers.map(async (layer) => {
          await layer.connect();
          return layer;
        }),
      )
    )
      .filter((result) => {
        if (result.status === "rejected") {
          console.warn("Failed to connect persistence layer:", result.reason);
          return false;
        }
        return true;
      })
      .map((result) =>
        (result as PromiseFulfilledResult<PersistenceLayer>).value
      );

    if (resolvedLayers.length > 0 && connectedLayers.length === 0) {
      throw new Error("No persistence layers available for new space");
    }

    if (connectedLayers.length > 0) {
      const initOps = space.tree.getAllOps();
      const savedLayers = (
        await Promise.allSettled(
          connectedLayers.map(async (layer) => {
            await layer.saveTreeOps(space.getId(), initOps);
            return layer;
          }),
        )
      )
        .filter((result) => {
          if (result.status === "rejected") {
            console.warn("Failed to save initial ops to layer:", result.reason);
            return false;
          }
          return true;
        })
        .map((result) =>
          (result as PromiseFulfilledResult<PersistenceLayer>).value
        );

      if (savedLayers.length === 0) {
        throw new Error(
          "Failed to initialize persistence layers for new space",
        );
      }

      const runner = new SpaceRunner(space, savedLayers, options, pointer);
      await runner.start();
      return runner;
    }

    const runner = new SpaceRunner(space, [], options);
    await runner.start();
    return runner;
  }

  static async loadFromLayers(
    pointer: SpaceRunnerPointer,
    layers: PersistenceLayer[],
    options: SpaceRunnerOptions = {},
  ): Promise<{ space: Space; runner: SpaceRunner }> {
    const resolvedLayers = this.resolveLayers(pointer, layers, options);
    const layerPromises = resolvedLayers.map(async (layer) => {
      await layer.connect();
      const ops = await layer.loadSpaceTreeOps();
      return { layer, ops };
    });
    const layerResultsPromise = Promise.allSettled(layerPromises);

    let space: Space | null = null;
    let firstResult:
      | { layer: PersistenceLayer; ops: VertexOperation[] }
      | null = null;
    let availableResults: {
      layer: PersistenceLayer;
      ops: VertexOperation[];
    }[] = [];
    try {
      firstResult = await Promise.any(layerPromises);
      space = new Space(new RepTree(uuid(), firstResult.ops));
    } catch (error) {
      console.error("Failed to load space tree from any layer:", error);
      console.log("As a fallback, will try to load from all layers");
    }

    const settledResults = await layerResultsPromise;
    availableResults = settledResults
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<
          { layer: PersistenceLayer; ops: VertexOperation[] }
        > => result.status === "fulfilled",
      )
      .map((result) => result.value);

    if (availableResults.length === 0) {
      throw new Error("No persistence layers available to load space");
    }

    const availableLayers = availableResults.map((result) => result.layer);

    if (!space) {
      const allOps: VertexOperation[] = [];
      availableResults.forEach((result) => {
        allOps.push(...result.ops);
      });

      space = new Space(new RepTree(uuid(), allOps));
    }

    availableResults.forEach((result) => {
      if (result !== firstResult && result.ops.length > 0) {
        space!.tree.merge(result.ops);
      }
    });

    const runner = new SpaceRunner(space, availableLayers, options, pointer);
    await runner.loadSecrets();
    await runner.start();
    return { space, runner };
  }

  private static resolveLayers(
    pointer: SpaceRunnerPointer,
    layers: PersistenceLayer[],
    options: SpaceRunnerOptions,
  ): PersistenceLayer[] {
    if (layers.length > 0) {
      return layers;
    }

    if (options.resolvePersistenceLayers) {
      return options.resolvePersistenceLayers(pointer, options.hostType);
    }

    const hostLabel = options.hostType ?? "unknown";
    throw new Error(
      `No persistence layers provided for ${pointer.uri} in ${hostLabel} host type`,
    );
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

    this.attachFileStoreProvider();
    this.registerTreeLoader();
    this.setupOperationTracking();
    this.initBackend();
    await this.setupTwoWaySync();
    if (this.persistenceLayers.length > 0) {
      await this.syncTreeOpsBetweenLayers(this.space.getId());
    }
    this.started = true;
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
      const layerOpsPromises = this.persistenceLayers.map(async (layer) => {
        await layer.connect();
        const ops = await layer.loadTreeOps(treeId);
        return { layer, ops };
      });
      const allOpsFromLayers = await Promise.all(layerOpsPromises);

      for (const { layer, ops } of allOpsFromLayers) {
        const opsIdSet = new Set<string>();
        for (const op of ops) {
          opsIdSet.add(`${op.id.counter}@${op.id.peerId}`);
        }

        const missingOps: VertexOperation[] = [];

        for (const { layer: layerB, ops: opsB } of allOpsFromLayers) {
          if (layer === layerB) {
            continue;
          }

          for (const opB of opsB) {
            const opBId = `${opB.id.counter}@${opB.id.peerId}`;
            if (!opsIdSet.has(opBId)) {
              missingOps.push(opB);
              opsIdSet.add(opBId);
            }
          }
        }

        if (missingOps.length > 0) {
          const isSpaceTree = this.space.getId() === treeId;
          if (isSpaceTree) {
            console.log(
              `Saving missing ops for the SPACE: ${treeId} to layer: ${layer.id}`,
              missingOps,
            );
          } else {
            console.log(
              `Saving missing ops for tree ${treeId} to layer: ${layer.id}`,
              missingOps,
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
