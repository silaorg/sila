import { SpaceRunner } from "@sila/core"
import { VertexOperation } from "reptree"

export interface SyncLayer {
  readonly id: string
  readonly type: 'local' | 'remote'

  // The main reason SyncLayer exists is to provide a way to load and save ops
  loadSpaceTreeOps(): Promise<VertexOperation[]>
  loadTreeOps(treeId: string): Promise<VertexOperation[]>
  saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void>

  // Implement them if the sync layer requires a connection or any pre-loading actions
  connect?(): Promise<void>
  isConnected?(): boolean
  disconnect?(): Promise<void>

  // Secrets handling is optional
  loadSecrets?(): Promise<Record<string, string> | undefined>
  saveSecrets?(secrets: Record<string, string>): Promise<void>

  // Two-way sync is optional
  startListening?(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void>
  stopListening?(): Promise<void>
}