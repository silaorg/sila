import { Vertex } from "reptree";
import type { Space } from "../Space";
import { bytesToDataUrl } from "./dataUrl";
import {
  getRootForPath,
  parseFileUri,
  resolvePathFromRoot,
  vertexToFileUri,
} from "./filePathUtils";

export interface FileReference {
  tree: string;
  vertex: string;
}

export interface ResolvedFileWithData {
  id: string;
  kind: string;
  name?: string;
  alt?: string;
  /** Logical path in the workspace or chat, e.g. "file:///assets/pic.png" or "file:notes.txt" */
  path?: string;
  dataUrl: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
}

export interface ResolvedFileInfo {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  url: string;
  hash: string;
}

export interface ResolvedFileInfoWithKind extends ResolvedFileInfo {
  kind: string;
}

/**
 * FileResolver is for resolving file references within a Space file store.
 */
export class FileResolver {
  private space: Space | null = null;

  constructor(space?: Space) {
    if (space) {
      this.setSpace(space);
    }
  }

  setSpace(space: Space) {
    this.space = space;
  }

  /**
   * Resolves a single file reference to file information - the reference will contain a URL to the file
   * Framework-agnostic method for resolving file references
   */
  async resolveFileReference(
    fileRef: FileReference,
  ): Promise<ResolvedFileInfo | null> {
    if (!this.space) {
      console.error("No space available for file resolution");
      return null;
    }

    try {
      // Validate fileRef before proceeding
      if (!fileRef.tree || !fileRef.vertex) {
        console.error("Invalid file reference:", fileRef);
        return null;
      }

      // Load the files app tree
      const filesTree = await this.space.loadAppTree(fileRef.tree);
      if (!filesTree) {
        console.error(`Files tree not found: ${fileRef.tree}`);
        return null;
      }

      // Get the file vertex
      const fileVertex = filesTree.tree.getVertex(fileRef.vertex);
      if (!fileVertex) {
        console.error(`File vertex not found: ${fileRef.vertex}`);
        return null;
      }

      if (!fileVertex) {
        console.error("File vertex not found:", fileRef);
        return null;
      }

      // Extract metadata from the file vertex
      const hash = fileVertex.getProperty("hash") as string | undefined;
      const id = fileVertex.getProperty("id") as string | undefined;
      const storageId = hash ?? id;
      const name = fileVertex.name;
      const mimeType = fileVertex.getProperty("mimeType") as string;
      const size = fileVertex.getProperty("size") as number;
      const width = fileVertex.getProperty("width") as number;
      const height = fileVertex.getProperty("height") as number;

      if (!storageId) {
        console.error(
          `File vertex missing storage id (hash/id): ${fileVertex.id}`,
        );
        return null;
      }

      // Generate sila:// URL instead of loading bytes (hash or uuid)
      const spaceId = this.space.getId();
      const params: string[] = [];
      if (mimeType) {
        params.push(`type=${encodeURIComponent(mimeType)}`);
      }
      if (name) {
        params.push(`name=${encodeURIComponent(name)}`);
      }
      const query = params.length > 0 ? `?${params.join("&")}` : "";

      // @TODO: we will need to generate a web-based URL if this method runs from the server
      // e.g `api.silain.com/spaces/${spaceId}/files/${storageId}${query}`;
      const url = `sila://spaces/${spaceId}/files/${storageId}${query}`;

      return {
        id: fileVertex.id,
        name: name || "Unknown file",
        mimeType,
        size,
        width,
        height,
        url,
        hash: storageId,
      };
    } catch (error) {
      console.error("Failed to resolve file reference:", error);
      return null;
    }
  }

  /**
   * Resolves a single file vertex to file information - the reference will contain a URL to the file and metadata
   * @param fileVertex
   * @returns
   */
  resolveVertexToFileReference(fileVertex: Vertex): ResolvedFileInfo | null {
    if (!this.space) {
      console.error("No space available for file resolution");
      return null;
    }

    try {
      // Extract metadata from the file vertex
      const hash = fileVertex.getProperty("hash") as string | undefined;
      const id = fileVertex.getProperty("id") as string | undefined;
      const storageId = hash ?? id;
      const name = fileVertex.name;
      const mimeType = fileVertex.getProperty("mimeType") as string;
      const size = fileVertex.getProperty("size") as number;
      const width = fileVertex.getProperty("width") as number;
      const height = fileVertex.getProperty("height") as number;

      if (!storageId) {
        console.error(
          `File vertex missing storage id (hash/id): ${fileVertex.id}`,
        );
        return null;
      }

      // Generate sila:// URL instead of loading bytes (hash or uuid)
      const spaceId = this.space.getId();
      const params: string[] = [];
      if (mimeType) {
        params.push(`type=${encodeURIComponent(mimeType)}`);
      }
      if (name) {
        params.push(`name=${encodeURIComponent(name)}`);
      }
      const query = params.length > 0 ? `?${params.join("&")}` : "";

      // @TODO: we will need to generate a web-based URL if this method runs from the server
      // e.g `api.silain.com/spaces/${spaceId}/files/${storageId}${query}`;
      const url = `sila://spaces/${spaceId}/files/${storageId}${query}`;

      return {
        id: fileVertex.id,
        name: name || "Unknown file",
        mimeType,
        size,
        width,
        height,
        url,
        hash: storageId,
      };
    } catch (error) {
      console.error("Failed to resolve file reference:", error);
      return null;
    }
  }

  /**
   * Resolves multiple file references
   */
  async getFilesInfo(fileRefs: FileReference[]): Promise<ResolvedFileInfo[]> {
    const resolved: ResolvedFileInfo[] = [];

    for (const fileRef of fileRefs) {
      const resolvedFile = await this.resolveFileReference(fileRef);
      if (resolvedFile) {
        resolved.push(resolvedFile);
      }
    }

    return resolved;
  }

  /**
   * Resolves file references in attachments to data URLs - so the object itself contains the data
   * Used for UI rendering and AI consumption
   */
  async getFileData(
    fileRefs: FileReference[],
  ): Promise<ResolvedFileWithData[]> {
    if (!this.space) {
      console.error("No space available for file resolution");
      return [];
    }

    if (!fileRefs || fileRefs.length === 0) {
      return [];
    }

    const resolved: ResolvedFileWithData[] = [];
    const fileStore = this.space.fileStore;

    if (!fileStore) {
      console.error("FileStore not available for resolving file references");
      return [];
    }

    for (const file of fileRefs) {
      // If has file reference, resolve it
      if (file?.tree && file?.vertex) {
        try {
          const resolvedAttachment = await this.resolveFileReferenceToData(
            file,
            fileStore,
          );
          if (resolvedAttachment) {
            // Validate that resolved attachment has required dataUrl
            if (!resolvedAttachment.dataUrl || typeof resolvedAttachment.dataUrl !== 'string') {
              console.error(`Resolved file ${file.vertex} is missing dataUrl:`, resolvedAttachment);
              continue;
            }
            resolved.push(resolvedAttachment);
          } else {
            console.warn(`Failed to resolve file reference ${file.tree}:${file.vertex} - resolvedAttachment is null`);
          }
        } catch (error) {
          console.error(`Failed to resolve file reference ${file.tree}:${file.vertex}:`, error);
          // Skip attachments that failed to resolve instead of including empty dataUrl
          // This prevents AI from receiving invalid base64 data
        }
        continue;
      } else {
        console.warn("Invalid file reference missing tree or vertex:", file);
      }
    }

    if (fileRefs.length > resolved.length) {
      console.warn(`Only resolved ${resolved.length} out of ${fileRefs.length} file reference(s)`);
    }

    return resolved;
  }

  /**
   * Resolves a single file reference to a data URL for attachments
   */
  private async resolveFileReferenceToData(
    fileRef: FileReference,
    fileStore: any,
  ): Promise<ResolvedFileWithData | null> {
    if (!this.space) {
      console.error("No space available for file resolution");
      return null;
    }

    // Load the files app tree
    const filesTree = await this.space.loadAppTree(fileRef.tree);
    if (!filesTree) {
      throw new Error(`Files tree not found: ${fileRef.tree}`);
    }

    // Get the file vertex
    const fileVertex = filesTree.tree.getVertex(fileRef.vertex);
    if (!fileVertex) {
      throw new Error(`File vertex not found: ${fileRef.vertex}`);
    }

    // Get storage id from the file vertex
    const hash = fileVertex.getProperty("hash") as string | undefined;
    const id = fileVertex.getProperty("id") as string | undefined;
    const storageId = hash ?? id;
    if (!storageId) {
      throw new Error(`File vertex missing storage id for ${fileRef.vertex}`);
    }

    // If no FileStore available, we can't load the bytes
    if (!fileStore) {
      throw new Error("FileStore not available for resolving file references");
    }

    // Load the bytes from CAS or mutable store depending on identifier
    const bytes = hash
      ? await fileStore.getBytes(hash)
      : await fileStore.getMutable(id as string);

    // Get metadata from the file vertex
    const mimeType = fileVertex.getProperty("mimeType") as string;
    const size = fileVertex.getProperty("size") as number;
    const width = fileVertex.getProperty("width") as number;
    const height = fileVertex.getProperty("height") as number;

    // Best-effort logical path for this file so AI tools can reference it
    // Uses the same rules as searchFileMentions / pathToVertex.
    let path: string | undefined;
    try {
      path = this.vertexToPath(fileVertex);
    } catch {
      // Non-fatal: some vertices may not resolve cleanly to paths
    }

    // Convert bytes to data URL with proper MIME type
    const dataUrl = bytesToDataUrl(
      bytes,
      mimeType || "application/octet-stream",
    );

    return {
      id: fileRef.vertex,
      kind: mimeType?.startsWith("text/")
        ? "text"
        : (mimeType?.startsWith("image/") ? "image" : "file"),
      name: (fileVertex.name as string) ||
        (fileVertex.getProperty("name") as string),
      alt: undefined,
      dataUrl,
      mimeType,
      size,
      width,
      height,
      path,
    };
  }

  /**
   * Convert a vertex to a file path string
   * - Workspace files: "file:///assets/pic.jpg" (from space root)
   * - Chat files: "file:pic.jpg" (from chat files root)
   * @throws Error if vertex cannot be resolved
   */
  vertexToPath(vertex: Vertex): string {
    if (!this.space) {
      throw new Error("No current space available");
    }

    return vertexToFileUri(this.space, vertex);
  }

  /**
   * Convert a file path string to a vertex that refers to that file
   * @param path
   * @param relativeRootVertex
   * @returns
   */
  pathToVertex(path: string, relativeRootVertex?: Vertex): Vertex {
    if (!this.space) {
      throw new Error("No current space available");
    }

    const { isWorkspacePath, segments } = parseFileUri(path);

    if (isWorkspacePath) {
      const root = getRootForPath(this.space, undefined, true);
      return resolvePathFromRoot(root, segments, path);
    }

    if (!relativeRootVertex) {
      throw new Error("Relative root vertex is required for local paths");
    }

    return resolvePathFromRoot(relativeRootVertex, segments, path);
  }

  /**
   * Search for files to mention in the chat editor.
   * Searches workspace assets and optionally a relative root vertex (e.g., chat files).
   * @param query - Search query string
   * @param relativeRootVertex - Optional vertex to search (e.g., chat files root)
   * @returns Array of file mentions matching the query
   */
  async searchFileMentions(
    query: string,
    relativeRootVertex?: Vertex,
  ): Promise<Array<{ path: string; name: string }>> {
    const trimmed = query.trim().toLowerCase();
    const results: Array<{ path: string; name: string }> = [];
    const limit = 10;

    const collectFromRoot = (root: Vertex | undefined) => {
      if (!root || results.length >= limit) return;
      const stack: Vertex[] = [root];

      while (stack.length > 0 && results.length < limit) {
        const v = stack.pop() as Vertex;
        const mimeType = v.getProperty("mimeType") as string | undefined;
        const name = v.name ?? "";

        if (mimeType) {
          if (!trimmed || name.toLowerCase().includes(trimmed)) {
            try {
              const path = this.vertexToPath(v);
              results.push({
                path,
                name,
              });
            } catch (err) {
              // Skip vertices that can't be resolved to paths
              console.warn("Failed to resolve path for vertex", err);
            }
          }
        } else {
          // Folder vertex – traverse its children
          for (const child of v.children) {
            stack.push(child as Vertex);
          }
        }
      }
    };

    // Always search workspace assets
    const space = this.space;
    if (space) {
      const assetsRoot = space.getVertexByPath("assets") as Vertex | undefined;
      collectFromRoot(assetsRoot);
    }

    // Optionally search relative root vertex (e.g., chat files)
    if (relativeRootVertex) {
      collectFromRoot(relativeRootVertex);
    }

    return results;
  }
}
