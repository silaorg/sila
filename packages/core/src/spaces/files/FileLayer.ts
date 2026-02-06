import type { FileStoreProvider } from "./FileStore";

/**
 * FileLayer provides file storage for a space.
 * Unlike SyncLayer which handles operation synchronization,
 * FileLayer is dedicated to file upload/download/storage.
 */
export interface FileLayer {
  /** Unique identifier for this file layer */
  readonly id: string;

  /** Get the file store provider for this layer */
  getFileStoreProvider(): FileStoreProvider;

  // Future enhancements:
  // uploadMissingFiles?(): Promise<void>;
  // downloadMissingFiles?(): Promise<void>;
  // dispose?(): Promise<void>;
}
