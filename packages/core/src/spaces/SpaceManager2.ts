import { Space } from "./Space";
import { SpaceRunner2 } from "./SpaceRunner2";
import { SyncLayer } from "./sync/SyncLayer";

export type SpaceManager2Options = {
  /**
   * Setup sync layers for a space. Each platform can have different sync layers.
   * So a server and a desktop app can sync spaces in different ways.
   * Whatever we return here will be used for a space at a pointer.
   * @param uri The URI of the space.
   * @returns An array of sync layers setup for the space.
   */
  setupSyncLayers?: (uri: string) => SyncLayer[];

  /**
   * Setup space handler for a space. Coud be anything that needs a space to read or edit it.
   * E.g a UI component or a backend service.
   * It will be called when a space is just created or loaded.
   * @param uri The URI of the space.
   * @param space The space to setup handler for.
   */
  setupSpaceHandler?: (uri: string, space: Space) => void;

  /**
   * The timeout for loading a space. If a space is not loaded within this time,
   * it will throw an error.
   */
  timeoutForSpaceLoading?: number;
}

/**
 * Manages spaces and the way they sync.
 * It uses SpacePointer to identify where a space is located so it can load and save it.
 * Spaces get persisted and synced between peers using SyncLayer.
 * A space can have multiple sync layers, for example one for local storage
 * and one for remote storage. When we construct SpaceManager, we 
 * need to pass a function that would be responsible for setting up
 * the sync layers for a space depending on what platform we are running on.
 */
export class SpaceManager2 {
  private timeoutForSpaceLoading = 10000;
  private spaceRunners = new Map<string, SpaceRunner2>();
  private setupSyncLayers: (uri: string) => SyncLayer[];
  private setupSpaceHandler?: (uri: string, space: Space) => void;
  private handledSpaces = new Set<string>();

  constructor(options: SpaceManager2Options = {}) {
    this.setupSyncLayers = options.setupSyncLayers ? options.setupSyncLayers : () => [];
    this.timeoutForSpaceLoading = options.timeoutForSpaceLoading ?? 10000;
    this.setupSpaceHandler = options.setupSpaceHandler;
  }

  /**
   * Add an existing space we have in memory to the manager.
   * @param space The space to add.
   * @param uri The URI of the space.
   */
  addSpace(space: Space, uri: string) {
    const existingRunner = this.spaceRunners.get(uri);
    if (existingRunner) {
      throw new Error(`Space ${uri} is already added. You can get it using getSpace method.`);
    }

    const syncLayers = this.setupSyncLayers(uri);
    const runner = SpaceRunner2.fromExistingSpace(space, uri, syncLayers);
    this.spaceRunners.set(uri, runner);
    this.trySetupSpaceHandler(uri, space);
  }

  /**
   * Get a space by its URI.
   * @param uri The URI of the space.
   * @returns The space or null if not found.
   */
  getSpace(uri: string): Space | null {
    const spaceRunner = this.spaceRunners.get(uri);
    if (!spaceRunner) return null;
    return spaceRunner.space;
  }

  /**
   * Load a space at the URI with the help of the sync layers.
   * The ones we setup with `setupSyncLayers` in the constructor.
   * It will throw if it takes too long to load the space or the layers can't create a valid space.
   * @param uri The URI of the space.
   */
  async loadSpace(uri: string): Promise<Space> {
    const existingRunner = this.spaceRunners.get(uri);
    if (existingRunner) {
      const space = await existingRunner.loadSpace(this.timeoutForSpaceLoading);
      this.trySetupSpaceHandler(uri, space);
      return space;
    }

    const syncLayers = this.setupSyncLayers(uri);
    if (syncLayers.length === 0) {
      throw new Error(`No sync layers to load a space`);
    }

    const runner = SpaceRunner2.fromURI(uri, syncLayers);
    this.spaceRunners.set(uri, runner);

    const space = await runner.loadSpace(this.timeoutForSpaceLoading);
    this.trySetupSpaceHandler(uri, space);
    return space;
  }

  /**
   * Close a loaded space and dispose all of its sync layers.
   * If a space is not loaded, this is a no-op.
   */
  async closeSpace(uri: string): Promise<void> {
    const runner = this.spaceRunners.get(uri);
    if (!runner) {
      return;
    }

    await runner.dispose();
    this.spaceRunners.delete(uri);
    this.handledSpaces.delete(uri);
  }

  /**
   * Get sync layers for an active space.
   */
  getSyncLayers(uri: string): SyncLayer[] | undefined {
    return this.spaceRunners.get(uri)?.layers;
  }

  getRunner(uri: string): SpaceRunner2 | undefined {
    return this.spaceRunners.get(uri);
  }

  getActiveSpaces(): Space[] {
    return Array.from(this.spaceRunners.values())
      .map((runner) => runner.space)
      .filter((space): space is Space => space !== null);
  }

  private trySetupSpaceHandler(uri: string, space: Space): void {
    if (!this.setupSpaceHandler) return;
    if (this.handledSpaces.has(uri)) return;

    this.handledSpaces.add(uri);
    this.setupSpaceHandler(uri, space);
  }
}
