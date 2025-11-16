/**
 * Metadata stored on a file vertex in the Files tree.
 * Does not include transport-specific fields like dataUrl or sila:// URL.
 */
export interface FileInfo {
  name: string;
  /**
   * Immutable CAS hash for static files (hash-based storage).
   * When present, the file is immutable and stored under its SHA-256 hash.
   */
  hash?: string;
  /**
   * Mutable UUID identifier for editable files (uuid-based storage).
   * When present (and hash is absent), the file is mutable and stored under this UUID.
   */
  id?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
}


