import { SpaceRunner } from "@sila/core"
import { VertexOperation } from "reptree"

/**
 * SyncLayer is for persisting spaces and syncing them between peers.
 * SpaceRunner depends on SyncLayer to load and save ops.
 * Each SyncLayer can have its own source. For example, one could connect 
 * to an OS's file system and another use a browser's IndexedDB.
 * At a minimum it should provide a way to load and save ops.
 * It can also provide a way to stream ops from its source to the SpaceRunner.
 */
export interface SyncLayer {
  readonly id: string
  readonly type: 'local' | 'remote'

  // Reference a SpaceRunner in case if the layer would benefit from it
  spaceRunner?: SpaceRunner

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