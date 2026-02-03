import { Space } from "./Space";
import { SpaceRunner2 } from "./SpaceRunner2";
import { SyncLayer } from "./sync/SyncLayer";

export interface SpacePointer2 {
  id: string;
  uri: string;
  name: string | null;
  createdAt: Date;
  userId: string | null;
}

export type SpaceManager2Options = {
  /**
   * Setup sync layers for a space. Each platform can have different sync layers.
   * So a server and a desktop app can sync spaces in different ways.
   * Whatever we return here will be used for a space at a pointer.
   * @param spacePointer The pointer to the space.
   * @returns An array of sync layers setup for the space.
   */
  setupSyncLayers?: (spacePointer: SpacePointer2) => SyncLayer[];

  /**
   * Setup space handler for a space. Coud be anything that needs a space to read or edit it.
   * E.g a UI component or a backend service.
   * It will be called when a space is just created or loaded.
   * @param spacePointer The pointer to the space.
   * @param space The space to setup handler for.
   */
  setupSpaceHandler?: (spacePointer: SpacePointer2, space: Space) => void;
}

/**
 * Manages spaces and the way they sync.
 * It uses SpacePointer to identify where a space is located so it can
 * load and save it.
 * Spaces get persisted and synced between peers using SyncLayer.
 * A space can have multiple sync layers, for example one for local storage
 * and one for remote storage. When we construct SpaceManager, we 
 * need to pass a function that would be responsible for setting up
 * the sync layers for a space depending on what platform we are running on.
 */
export class SpaceManager2 {

  private spaceRunners = new Map<string, SpaceRunner2>();
  private setupSyncLayers: (spacePointer: SpacePointer2) => SyncLayer[];

  constructor(private options: SpaceManager2Options) {
    this.setupSyncLayers = options.setupSyncLayers ? options.setupSyncLayers : () => [];
  }

  /**
   * Add an existing space we have in memory to the manager.
   * @param space The space to add.
   * @param uri The URI of the space.
   */
  addSpace(space: Space, uri: string) {
    const pointer: SpacePointer2 = {
      id: space.getId(),
      uri: uri,
      name: space.name ?? null,
      createdAt: space.createdAt,
      userId: null,
    };

    const syncLayers = this.setupSyncLayers(pointer);
    const runner = SpaceRunner2.fromExistingSpace(space, pointer, syncLayers);
    this.spaceRunners.set(pointer.uri, runner);

    if (this.options.setupSpaceHandler) {
      this.options.setupSpaceHandler(pointer, space);
    }
  }

  /**
   * Get a space by its pointer or URI.
   * @param ref The pointer or URI of the space.
   * @returns The space or null if not found.
   */
  getSpace(ref: string | SpacePointer2): Space | null {
    const uri = typeof ref === 'string' ? ref : ref.uri;
    const spaceRunner = this.spaceRunners.get(uri);
    if (!spaceRunner) return null;
    return spaceRunner.space;
  }

  /**
   * Load a space at the pointer with the help of the sync layers.
   * The ones sync layers we setup with `setupSyncLayers` in the constructor.
   * @param spacePointer The pointer to the space.
   */
  async loadSpace(spacePointer: SpacePointer2): Promise<Space | null> {
    const syncLayers = this.setupSyncLayers(spacePointer);
    const runner = SpaceRunner2.fromPointer(spacePointer, syncLayers);
    this.spaceRunners.set(spacePointer.uri, runner);
    if (runner.initSync) {
      await runner.initSync;
    }

    if (runner.space && this.options.setupSpaceHandler) {
      this.options.setupSpaceHandler(spacePointer, runner.space);
    }

    return runner.space;
  }

  /**
   * Close a space and disconnect its sync layers.
   * @param ref The pointer or URI of the space.
   */
  async closeSpace(ref: string | SpacePointer2) {
    const uri = typeof ref === 'string' ? ref : ref.uri;
    const runner = this.spaceRunners.get(uri);
    if (runner) {
      await runner.dispose();
      this.spaceRunners.delete(uri);
    }
  }

  get activeSpaces(): Space[] {
    const spaces: Space[] = [];
    for (const runner of this.spaceRunners.values()) {
      if (runner.space) {
        spaces.push(runner.space);
      }
    }
    return spaces;
  }

  getRunner(ref: string | SpacePointer2): SpaceRunner2 | undefined {
    const uri = typeof ref === 'string' ? ref : ref.uri;
    return this.spaceRunners.get(uri);
  }

}