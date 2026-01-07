import type { PersistenceLayer } from "@sila/core";
import { IndexedDBPersistenceLayer } from "./IndexedDBPersistenceLayer";
import { FileSystemPersistenceLayer } from "@sila/core";
import type { AppFileSystem } from "../../appFs";

/**
 * Determines which persistence layers are needed based on the space URI
 * @param spaceId The space ID
 * @param uri The space URI (local://, file path, http://, etc.)
 * @returns Array of persistence layers to use
 */
export function createPersistenceLayersForURI(spaceId: string, uri: string, fs: AppFileSystem | null): PersistenceLayer[] {
  const layers: PersistenceLayer[] = [];

  if (uri.startsWith("local://")) {
    // Local-only spaces: IndexedDB only
    layers.push(new IndexedDBPersistenceLayer(uri, spaceId));
  } else if (uri.startsWith("http://") || uri.startsWith("https://")) {
    // Server-synced spaces: IndexedDB + Server (future)
    layers.push(new IndexedDBPersistenceLayer(uri, spaceId));
    // TODO: Add server persistence layer when implemented
    // layers.push(new ServerPersistenceLayer(spaceId, uri));
  } else {
    // File system path: IndexedDB + FileSystem (dual persistence)
    layers.push(new IndexedDBPersistenceLayer(uri, spaceId));
    if (!fs) {
      throw new Error("App file system is not configured");
    }
    layers.push(new FileSystemPersistenceLayer(uri, spaceId, fs));
  }

  return layers;
}