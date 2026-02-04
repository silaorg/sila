import { Space, SyncLayer, VertexOperation } from "@sila/core";

export class TestInMemorySyncLayer implements SyncLayer {
  readonly id: string = 'test-in-memory-sync-layer';
  readonly type = 'local' as const;
  readonly space: Space;

  constructor(originalSpace: Space, private loadDelayMs: number) {
    this.space = originalSpace;
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    await new Promise(resolve => setTimeout(resolve, this.loadDelayMs));
    return this.space.tree.getAllOps() as VertexOperation[];
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    throw new Error("Not implemented");
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    await new Promise(resolve => setTimeout(resolve, this.loadDelayMs));
    const tree = this.space.getAppTree(treeId);
    if (!tree) {
      throw new Error("Tree not found");
    }
    return tree.tree.getAllOps() as VertexOperation[];
  }
}