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
    if (treeId === this.space.id) {
      this.space.tree.merge(ops);
    } else {
      const appTree = this.space.getAppTree(treeId);
      if (!appTree) {
        throw new Error("Tree not found");
      }
      appTree.tree.merge(ops);
    }
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    await new Promise(resolve => setTimeout(resolve, this.loadDelayMs));
    const tree = this.space.getAppTree(treeId);
    if (!tree) {
      throw new Error("Tree not found");
    }
    return tree.tree.getAllOps() as VertexOperation[];
  }

  startListening(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void> {
    this.space.tree.observeOpApplied((op) => {
      onIncomingOps(this.space.id, [op]);
    });

    this.space.observeTreeLoad((appTreeId) => {
      const appTree = this.space.getAppTree(appTreeId)!;
      appTree.tree.observeOpApplied((op) => {
        onIncomingOps(appTreeId, [op]);
      });
    });
    return Promise.resolve();
  }
}