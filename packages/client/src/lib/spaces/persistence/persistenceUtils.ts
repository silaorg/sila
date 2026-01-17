import type { PersistenceLayer } from "@sila/core";
import { IndexedDBPersistenceLayer } from "./IndexedDBPersistenceLayer";
import { FileSystemPersistenceLayer } from "@sila/core";
import type { AppFileSystem } from "../../appFs";

/**
 * Determines which persistence layers are needed based on the space URI
 * @param spaceId The underlying space ID (core identity)
 * @param uri The space pointer URI (UI/reference identity; local://, file path, http(s)://, etc.)
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
    // TODO: Add server persistence layer when implemented.
  } else if (uri.startsWith("capacitor://")) {
    // Mobile spaces: IndexedDB + FileSystem in app sandbox
    layers.push(new IndexedDBPersistenceLayer(uri, spaceId));
    if (!fs) {
      throw new Error("App file system is not configured");
    }
    layers.push(new FileSystemPersistenceLayer(uri, spaceId, fs));
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
