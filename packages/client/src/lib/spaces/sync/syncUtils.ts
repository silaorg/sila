import { FileSystemSyncLayer, LocalFileLayer, type SyncLayer, type FileLayer } from "@sila/core";
import type { AppFileSystem } from "../../appFs";
import { IndexedDBSyncLayer } from "./IndexedDBSyncLayer";
import { RemoteSyncLayer } from "./RemoteSyncLayer";

/**
 * Determines which sync layers are needed based on a space URI.
 */
export function createSyncLayersForURI(
  spaceId: string,
  uri: string,
  fs: AppFileSystem | null,
  getRemoteAuthToken?: () => string | null,
): SyncLayer[] {
  const layers: SyncLayer[] = [];

  if (uri.startsWith("memory://")) {
    return layers;
  }

  if (uri.startsWith("local://")) {
    layers.push(new IndexedDBSyncLayer(uri, spaceId));
    return layers;
  }

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    layers.push(new IndexedDBSyncLayer(uri, spaceId));
    layers.push(new RemoteSyncLayer(uri, spaceId, getRemoteAuthToken));
    return layers;
  }

  // Both local files and capacitor URIs use FS + IndexedDB fallback cache.
  layers.push(new IndexedDBSyncLayer(uri, spaceId));
  if (!fs) {
    throw new Error("App file system is not configured");
  }

  layers.push(new FileSystemSyncLayer(uri, spaceId, fs));
  return layers;
}

/**
 * Creates a file layer for a space based on its URI.
 * Returns undefined for memory:// and http:// URIs (no local file storage).
 * Returns LocalFileLayer for local:// and file:// URIs.
 */
export function createFileLayerForURI(
  uri: string,
  fs: AppFileSystem | null,
): FileLayer | undefined {
  // No file storage for memory-only spaces
  if (uri.startsWith("memory://")) {
    return undefined;
  }

  // No local file storage for remote-only spaces (will implement RemoteFileLayer later)
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return undefined;
  }

  // Local file storage for local:// and file:// URIs
  if (!fs) {
    throw new Error("App file system is not configured");
  }

  return new LocalFileLayer(uri, fs);
}
