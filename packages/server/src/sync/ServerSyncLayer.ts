import { SyncLayer } from "@sila/core";
import { VertexOperation } from "reptree";

export class ServerSyncLayer implements SyncLayer {
  readonly id = "server-sync-layer";
  readonly type = "remote";

  constructor() { }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    return [];
  }

  async loadTreeOps(_treeId: string): Promise<VertexOperation[]> {
    return [];
  }

  async saveTreeOps(_treeId: string, _ops: ReadonlyArray<VertexOperation>): Promise<void> {
    // No-op for now
  }
}

