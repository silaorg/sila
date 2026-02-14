import { SpaceRunner } from "@sila/core"
import { RepTree, VertexOperation } from "reptree"
import type { FileStoreProvider } from "../files/FileStore";

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

  // Reference a SpaceRunner in case if the layer needs it or a space inside it
  spaceRunner?: SpaceRunner

  /** Get the space ID from this layer's storage (optional, for migration) */
  getSpaceId?(): Promise<string | undefined>

  /** Load ops for the root tree of a space */
  loadSpaceTreeOps(): Promise<VertexOperation[]>
  /** Load ops for a specific tree */
  loadTreeOps(treeId: string): Promise<VertexOperation[]>
  /** Save ops for a specific tree */
  saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void>

  /** Upload ops from a tree that are missing from this layer */
  uploadMissingFromTree?(tree: RepTree): Promise<void>

  // Two-way sync is optional
  startListening?(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void>
  stopListening?(): Promise<void>

  // Secrets handling is optional
  loadSecrets?(): Promise<Record<string, string> | undefined>
  saveSecrets?(secrets: Record<string, string>): Promise<void>

  // Connection handling is optional
  connect?(): Promise<void>
  disconnect?(): Promise<void>

  // Optional cleanup method - called when SpaceRunner is disposed
  dispose?(): Promise<void>

  /**
   * If true, the layer is responsible for broadcasting ops to other peers.
   * SpaceRunner will pass all ops to this layer, not just local ones.
   */
  isBroadcasting?: boolean
}