import type { PersistenceLayer } from "@sila/core";
import type { VertexOperation } from "@sila/core";
import { isAnyPropertyOp } from "@sila/core";
import {
  getTreeOps,
  appendTreeOps,
  getAllSecrets,
  saveAllSecrets
} from "@sila/client/localDb";

/**
 * One-way persistence layer that saves space and app tree operations to IndexedDB.
 * Uses existing localDb.ts functionality for browser storage.
 */
export class IndexedDBPersistenceLayer implements PersistenceLayer {
  readonly id: string;
  readonly type = 'local' as const;

  private _connected = false;

  constructor(
    private spaceUri: string,
    private spaceId: string,
  ) {
    this.id = `indexeddb-${spaceUri}::${spaceId}`;
  }

  async connect(): Promise<void> {
    if (this._connected) return;

    // IndexedDB connection is handled automatically by Dexie
    // No explicit connection needed
    this._connected = true;
  }

  isConnected(): boolean {
    return this._connected;
  }

  async disconnect(): Promise<void> {
    if (!this._connected) return;

    // IndexedDB doesn't need explicit disconnection
    this._connected = false;
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    if (!this._connected) {
      throw new Error('IndexedDBPersistenceLayer not connected');
    }

    // Load operations for the main space tree (treeId = spaceId)
    return await getTreeOps(this.spaceUri, this.spaceId, this.spaceId);
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    if (!this._connected) {
      throw new Error('IndexedDBPersistenceLayer not connected');
    }

    if (ops.length === 0) return;

    // Do not persist transient property ops
    const opsToSave = ops.filter(op => !isAnyPropertyOp(op) || !op.transient);
    if (opsToSave.length === 0) return;

    // Save operations to IndexedDB
    await appendTreeOps(this.spaceUri, this.spaceId, treeId, opsToSave);
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    if (!this._connected) {
      throw new Error('IndexedDBPersistenceLayer not connected');
    }

    // Load operations for the specified app tree
    return await getTreeOps(this.spaceUri, this.spaceId, treeId);
  }

  async loadSecrets(): Promise<Record<string, string> | undefined> {
    if (!this._connected) {
      throw new Error('IndexedDBPersistenceLayer not connected');
    }

    // Load secrets from IndexedDB
    return await getAllSecrets(this.spaceUri, this.spaceId);
  }

  async saveSecrets(secrets: Record<string, string>): Promise<void> {
    if (!this._connected) {
      throw new Error('IndexedDBPersistenceLayer not connected');
    }

    if (Object.keys(secrets).length === 0) return;

    // Save secrets to IndexedDB
    await saveAllSecrets(this.spaceUri, this.spaceId, secrets);
  }

  // No startListening/stopListening methods - one-way persistence only
} 