import { Space } from "./Space";
import type { PersistenceLayer } from "./persistence/PersistenceLayer";
import type { SpaceRunnerHostType, SpaceRunnerOptions, SpaceRunnerPointer } from "./SpaceRunner";
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

export type SpaceManagerOptions = {
  resolvePersistenceLayers?: (pointer: SpacePointer, hostType: SpaceRunnerHostType | undefined) => PersistenceLayer[];
  shouldEnableBackend?: (pointer: SpacePointer, hostType: SpaceRunnerHostType | undefined) => boolean;
  hostType?: SpaceRunnerHostType;
};

/**
 * Manages spaces and their persistence layers.
 * Handles loading, saving, and orchestrating multiple persistence strategies.
 */
export class SpaceManager {
  private runners = new Map<string, SpaceRunner>();
  private resolvePersistenceLayers?: (pointer: SpacePointer, hostType: SpaceRunnerHostType | undefined) => PersistenceLayer[];
  private shouldEnableBackend?: (pointer: SpacePointer, hostType: SpaceRunnerHostType | undefined) => boolean;
  private hostType?: SpaceRunnerHostType;

  constructor(options: SpaceManagerOptions = {}) {
    this.resolvePersistenceLayers = options.resolvePersistenceLayers;
    this.shouldEnableBackend = options.shouldEnableBackend;
    this.hostType = options.hostType;
  }

  /**
   * Add a new space to the manager. Saves the space to the persistence layers.
   * @param space - The space to add
   * @param persistenceLayers - The persistence layers to use for the space
   */
  async addNewSpace(
    space: Space,
    persistenceLayers: PersistenceLayer[] = [],
    spaceKey?: string,
  ): Promise<void> {
    const spaceId = space.getId();
    const key = spaceKey ?? spaceId;
    const pointer: SpacePointer = {
      id: spaceId,
      uri: key,
      name: space.name ?? null,
      createdAt: space.createdAt,
      userId: null,
    };

    if (this.runners.has(key)) {
      return;
    }

    const resolvePersistenceLayers = this.resolvePersistenceLayers
      ? (runnerPointer: SpaceRunnerPointer, hostType: SpaceRunnerHostType | undefined) =>
        this.resolvePersistenceLayers?.(runnerPointer as SpacePointer, hostType) ?? []
      : undefined;

    const runner = await SpaceRunner.createForNewSpace(space, pointer, persistenceLayers, {
      isLocal: key.startsWith("local://"),
      enableBackend: this.shouldEnableBackend
        ? this.shouldEnableBackend(pointer, this.hostType)
        : false,
      hostType: this.hostType,
      resolvePersistenceLayers,
    });
    this.runners.set(key, runner);
  }

  /**
   * Load an existing space from persistence layers.
   * Will return space as soon as it loads from the fastest layer
   * and merge in the ops from the other layers as they load.
   * @param pointer - The pointer to the space
   * @param persistenceLayers - The persistence layers to use for the space
   */
  async loadSpace(pointer: SpacePointer, persistenceLayers: PersistenceLayer[] = []): Promise<Space> {
    const key = pointer.uri;

    // Check if already loaded
    const existingRunner = this.runners.get(key);
    if (existingRunner) {
      return existingRunner.getSpace();
    }

    const { space, runner } = await SpaceRunner.loadFromLayers(
      { id: pointer.id, uri: pointer.uri },
      persistenceLayers,
      {
        isLocal: pointer.uri.startsWith("local://"),
        enableBackend: this.shouldEnableBackend
          ? this.shouldEnableBackend(pointer, this.hostType)
          : false,
        hostType: this.hostType,
        resolvePersistenceLayers: this.resolvePersistenceLayers
          ? (runnerPointer: SpaceRunnerPointer, hostType: SpaceRunnerHostType | undefined) =>
            this.resolvePersistenceLayers?.(runnerPointer as SpacePointer, hostType) ?? []
          : undefined,
      },
    );
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
