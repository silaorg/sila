import { Space, SyncLayer, VertexOperation } from "@sila/core";

export type TestInMemorySyncLayerOptions = {
  loadDelayMs?: number;
  shouldFailToLoadSpace?: boolean;
  shouldFailToLoadTree?: boolean;
  // If true, the op will be excluded from the loaded ops.
  shouldExcludeOp?: (op: VertexOperation, index: number) => boolean;
}

export class TestInMemorySyncLayer implements SyncLayer {
  readonly id: string = 'test-in-memory-sync-layer';
  readonly type = 'local' as const;
  readonly space: Space;
  private options: TestInMemorySyncLayerOptions;

  constructor(originalSpace: Space, optionsOrDelay: number | TestInMemorySyncLayerOptions) {
    this.space = originalSpace;
    if (typeof optionsOrDelay === 'number') {
      this.options = { loadDelayMs: optionsOrDelay };
    } else {
      this.options = optionsOrDelay;
    }
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    if (this.options.loadDelayMs) {
      await new Promise(resolve => setTimeout(resolve, this.options.loadDelayMs));
    }
    if (this.options.shouldFailToLoadSpace) {
      throw new Error("Failed to load space ops");
    }

    const allOps = this.space.tree.getAllOps() as VertexOperation[];
    if (this.options.shouldExcludeOp) {
      return allOps.filter((op, index) => !this.options.shouldExcludeOp!(op, index));
    }
    return allOps;
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    this.space.addTreeOps(treeId, ops as VertexOperation[]);
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    if (this.options.loadDelayMs) {
      await new Promise(resolve => setTimeout(resolve, this.options.loadDelayMs));
    }

    if (this.options.shouldFailToLoadTree) {
      throw new Error("Failed to load tree ops");
    }

    if (treeId === this.space.id) {
      const allOps = this.space.tree.getAllOps() as VertexOperation[];
      if (this.options.shouldExcludeOp) {
        return allOps.filter((op, index) => !this.options.shouldExcludeOp!(op, index));
      }
      return allOps;
    }

    const tree = this.space.getAppTree(treeId);
    if (!tree) {
      throw new Error("Tree not found");
    }
    const allOps = tree.tree.getAllOps() as VertexOperation[];
    if (this.options.shouldExcludeOp) {
      return allOps.filter((op, index) => !this.options.shouldExcludeOp!(op, index));
    }
    return allOps;
  }

  startListening(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void> {
    this.space.tree.observeOpApplied((op) => {
      onIncomingOps(this.space.id, [op]);
    });

    this.space.onTreeLoad((appTreeId) => {
      const appTree = this.space.getAppTree(appTreeId)!;
      appTree.tree.observeOpApplied((op) => {
        onIncomingOps(appTreeId, [op]);
      });
    });
    return Promise.resolve();
  }
}