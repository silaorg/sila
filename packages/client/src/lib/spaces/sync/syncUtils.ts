import { FileSystemSyncLayer, type SyncLayer } from "@sila/core";
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
    layers.push(new RemoteSyncLayer(uri, getRemoteAuthToken));
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
