import type { VertexOperation } from "reptree";

/**
 * Interface for persistence layers that handle space and app tree operations.
 * Supports both one-way (write-only) and two-way (bidirectional) sync models.
 */
export interface PersistenceLayer {
  // Lifecycle
  connect(): Promise<void>
  isConnected(): boolean
  disconnect(): Promise<void>

  // Multi-tree support - handles both space tree and app trees
  loadSpaceTreeOps(): Promise<VertexOperation[]>
  saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void>
  
  // Tree loader callback for lazy loading AppTrees
  loadTreeOps(treeId: string): Promise<VertexOperation[]>
  
  // Secrets management
  loadSecrets(): Promise<Record<string, string> | undefined>
  saveSecrets(secrets: Record<string, string>): Promise<void>
  
  // Optional: for two-way sync layers
  startListening?(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void>
  stopListening?(): Promise<void>
  
  // Metadata
  readonly id: string
  readonly type: 'local' | 'remote'
}

/**
 * Abstract base class for persistence layers that require connection management.
 * Provides built-in race condition safety for connect/disconnect operations.
 * 
 * Use this for persistence layers that need to establish/tear down connections
 * (e.g., file system, network, database connections).
 */
export abstract class ConnectedPersistenceLayer implements PersistenceLayer {
  // Metadata
  abstract readonly id: string;
  abstract readonly type: 'local' | 'remote';

  // Connection state management with race condition safety
  private _connected = false;
  private connectPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    // If already connected, return immediately
    if (this._connected) return;
    
    // If already connecting, return the existing promise
    if (this.connectPromise) {
      return this.connectPromise;
    }
    
    // Start connecting and store the promise
    this.connectPromise = this.doConnect();
    
    try {
      await this.connectPromise;
      this._connected = true;
    } finally {
      // Clear the promise whether successful or failed
      this.connectPromise = null;
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  async disconnect(): Promise<void> {
    // Wait for any ongoing connection to complete
    if (this.connectPromise) {
      try {
        await this.connectPromise;
      } catch {
        // Ignore connection errors during disconnect
      }
    }

    if (!this._connected) return;

    await this.doDisconnect();
    this._connected = false;
  }

  // Abstract methods that implementations must provide
  protected abstract doConnect(): Promise<void>;
  protected abstract doDisconnect(): Promise<void>;
  
  // Abstract methods from PersistenceLayer interface
  abstract loadSpaceTreeOps(): Promise<VertexOperation[]>;
  abstract saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void>;
  abstract loadTreeOps(treeId: string): Promise<VertexOperation[]>;
  abstract loadSecrets(): Promise<Record<string, string> | undefined>;
  abstract saveSecrets(secrets: Record<string, string>): Promise<void>;
  
  // Optional: for two-way sync layers
  startListening?(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void>;
  stopListening?(): Promise<void>;
} 