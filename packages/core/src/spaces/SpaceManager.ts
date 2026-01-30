import { RepTree } from "reptree";
import type { VertexOperation } from "reptree";
import { Space } from "./Space";
import type { PersistenceLayer } from "./persistence/PersistenceLayer";
import uuid from "../utils/uuid";
import { SpaceRunner } from "./SpaceRunner";

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
  private runners = new Map<string, SpaceRunner>();

  private getFulfilledResults<T>(results: PromiseSettledResult<T>[]): T[] {
    return results
      .filter((result): result is PromiseFulfilledResult<T> => result.status === "fulfilled")
      .map((result) => result.value);
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

      const runner = new SpaceRunner(space, savedLayers, {
        isLocal: key.startsWith("local://"),
      });
      await runner.start();
      this.runners.set(key, runner);
    }

    if (!this.runners.has(key)) {
      const runner = new SpaceRunner(space, [], {
        isLocal: key.startsWith("local://"),
      });
      await runner.start();
      this.runners.set(key, runner);
    }
  }

  /**
   * Load an existing space from persistence layers.
   * Will return space as soon as it loads from the fastest layer
   * and merge in the ops from the other layers as they load.
   * @param pointer - The pointer to the space
   * @param persistenceLayers - The persistence layers to use for the space
   */
  async loadSpace(pointer: SpacePointer, persistenceLayers: PersistenceLayer[]): Promise<Space> {
    const key = pointer.uri;

    // Check if already loaded
    const existingRunner = this.runners.get(key);
    if (existingRunner) {
      return existingRunner.getSpace();
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

    availableResults.forEach((result) => {
      if (result !== firstResult && result.ops.length > 0) {
        space!.tree.merge(result.ops);
      }
    });

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

    const runner = new SpaceRunner(space, availableLayers, {
      isLocal: pointer.uri.startsWith("local://"),
    });
    await runner.start();
    this.runners.set(key, runner);

    return space;
  }

  /**
   * Close a space and disconnect its persistence layers
   */
  async closeSpace(spaceKey: string): Promise<void> {
    const runner = this.runners.get(spaceKey);
    if (runner) {
      await runner.dispose();
      this.runners.delete(spaceKey);
    }
  }

  /**
   * Get all active spaces
   */
  getActiveSpaces(): Space[] {
    return Array.from(this.runners.values()).map((runner) => runner.getSpace());
  }

  /**
   * Get a specific space by ID
   */
  getSpace(spaceKey: string): Space | undefined {
    return this.runners.get(spaceKey)?.getSpace();
  }

  getPersistenceLayers(spaceKey: string): PersistenceLayer[] | undefined {
    return this.runners.get(spaceKey)?.getPersistenceLayers();
  }

  getRunner(spaceKey: string): SpaceRunner | undefined {
    return this.runners.get(spaceKey);
  }

  /**
   * Add a persistence layer to an existing space
   */
  addPersistenceLayer(spaceKey: string, layer: PersistenceLayer): void {
    const runner = this.runners.get(spaceKey);
    if (!runner) return;
    runner.addPersistenceLayer(layer);
  }

  /**
   * Remove a persistence layer from a space
   */
  removePersistenceLayer(spaceKey: string, layerId: string): void {
    const runner = this.runners.get(spaceKey);
    if (!runner) return;
    runner.removePersistenceLayer(layerId);
  }
} 
