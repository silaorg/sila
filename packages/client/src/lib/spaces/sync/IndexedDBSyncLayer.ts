import type { SyncLayer, VertexOperation } from "@sila/core";
import { RepTree } from "@sila/core";
import { isAnyPropertyOp } from "@sila/core";
import {
  appendTreeOps,
  getAllSecrets,
  getTreeOps,
  saveAllSecrets,
} from "../../localDb";

/**
 * SyncLayer backed by local IndexedDB storage.
 */
export class IndexedDBSyncLayer implements SyncLayer {
  readonly id: string;
  readonly type = "local" as const;

  constructor(
    private readonly spaceUri: string,
    private readonly spaceId: string,
  ) {
    this.id = `indexeddb-sync-${spaceUri}::${spaceId}`;
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    return getTreeOps(this.spaceUri, this.spaceId, this.spaceId);
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    return getTreeOps(this.spaceUri, this.spaceId, treeId);
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    if (ops.length === 0) return;

    const opsToSave = ops.filter((op) => !isAnyPropertyOp(op) || !op.transient);
    if (opsToSave.length === 0) return;

    await appendTreeOps(this.spaceUri, this.spaceId, treeId, opsToSave);
  }

  async loadSecrets(): Promise<Record<string, string> | undefined> {
    return getAllSecrets(this.spaceUri, this.spaceId);
  }

  async saveSecrets(secrets: Record<string, string>): Promise<void> {
    if (Object.keys(secrets).length === 0) return;
    await saveAllSecrets(this.spaceUri, this.spaceId, secrets);
  }

  async uploadMissingFromTree(tree: RepTree): Promise<void> {
    const root = tree.root;
    if (!root) {
      return;
    }

    const opsInLayer = await this.loadTreeOps(root.id);

    try {
      const layerTree = new RepTree(root.id, opsInLayer);
      const layerStateVector = layerTree.getStateVector() ?? [];
      // @TODO: consider returning non readonly or use readonly everywhere
      // and perhaps as a separate type StateVector or smth
      // @ts-ignore
      const missingOps = tree.getMissingOps(layerStateVector);

      if (missingOps.length === 0) {
        return;
      }

      await this.saveTreeOps(root.id, missingOps);
    } catch (e) {
      console.error(`Failed to upload missing ops from tree ${root.id}`, e);
    }

  }
}
