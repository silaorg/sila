import { SpaceRunner } from "@sila/core"
import { VertexOperation } from "reptree"

export interface SyncLayer {
  readonly id: string
  readonly type: 'local' | 'remote'

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

  // Optional: if our layer would benefit from having a reference to the space it's handling
  referenceSpaceRunner?(spaceRunner: SpaceRunner): void;
}