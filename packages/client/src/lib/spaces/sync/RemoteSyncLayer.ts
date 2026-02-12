import type { SyncLayer, VertexOperation } from "@sila/core";

/**
 * Placeholder remote layer. Remote sync is intentionally deferred.
 */
export class RemoteSyncLayer implements SyncLayer {
  readonly id: string;
  readonly type = "remote" as const;

  constructor(
    private readonly spaceUri: string,
    private readonly getAuthToken?: () => string | null,
  ) {
    this.id = `remote-sync-${spaceUri}`;
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    return [];
  }

  async loadTreeOps(_treeId: string): Promise<VertexOperation[]> {
    return [];
  }

  async saveTreeOps(
    _treeId: string,
    _ops: ReadonlyArray<VertexOperation>,
  ): Promise<void> {
    // Intentionally no-op until remote sync task is implemented.
  }

  async startListening(
    _onIncomingOps: (treeId: string, ops: VertexOperation[]) => void,
  ): Promise<void> {
    // Intentionally no-op until remote sync task is implemented.
  }
}
