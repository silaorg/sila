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
  // @NOTE: it depends on a space pointer, so it should be determined
  // based on the space
  enableBacked: boolean;
  setupSyncLayers?: (spacePointer: SpacePointer2) => SyncLayer[];
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

  constructor(options: SpaceManager2Options) {
    this.setupSyncLayers = options.setupSyncLayers ? options.setupSyncLayers : () => [];
  }

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
  }

  loadSpace(spacePointer: SpacePointer2) {
    const syncLayers = this.setupSyncLayers(spacePointer);
    const runner = SpaceRunner2.fromPointer(spacePointer, syncLayers);
    this.spaceRunners.set(spacePointer.uri, runner);
  }

}