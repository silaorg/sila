import { Space, SyncLayer, VertexOperation } from "@sila/core";

export class TestInMemorySyncLayer implements SyncLayer {
  id: string = 'test-in-memory-sync-layer';
  type: 'local' | 'remote' = 'local';
  space: Space;

  constructor(originalSpace: Space, private loadDelayMs: number) {
    this.space = originalSpace;
  }

  async connect(): Promise<void> {
    // no-op
  }

  isConnected(): boolean {
    return true;
  }

  async disconnect(): Promise<void> {
    // no-op
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    const ops = this.space.tree.getAllOps() as VertexOperation[];
    await new Promise(resolve => setTimeout(resolve, this.loadDelayMs));
    return ops;
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    // no-op for now
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    return [];
  }

  async loadSecrets(): Promise<Record<string, string> | undefined> {
    return undefined;
  }

  async saveSecrets(secrets: Record<string, string>): Promise<void> {
    // no-op
  }
}