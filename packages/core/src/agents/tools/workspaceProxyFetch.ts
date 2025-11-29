import type { ProxyFetch } from "../../utils/proxyFetch";
import { proxyFetch } from "../../utils";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";
import { ChatAppData } from "../../spaces/ChatAppData";

const MAX_TEXT_BYTES = 1024 * 1024; // 1 MB safety limit for tool reads
const MAX_FILE_BYTES = 10 * 1024 * 1024 * 10; // 100 MB safety limit for binary fetches

/**
 * Resolve a file: URI into text content from the current workspace.
 *
 * Supported forms:
 * - Workspace-level: file:///assets/brand.md
 *   - Resolved from Space.rootVertex, path is absolute inside the space tree.
 * - Chat-level:      file:assets/document.md
 *   - Resolved from the current chat AppTree root, treating the path as
 *     a logical path inside this chat (by default attachments live under
 *     ChatAppData.ASSETS_ROOT_PATH = "assets").
 */
export async function resolveWorkspaceFileUrl(
  url: string,
  space: Space,
  appTree?: AppTree
): Promise<string> {
  const fileVertex = resolveFileVertex(url, space, appTree);
  const logicalPath = getLogicalPath(url);
  const bytes = await readBytesFromVertex(space, fileVertex, logicalPath, MAX_TEXT_BYTES);
  
  const mimeType = (fileVertex.getProperty("mimeType") as string | undefined)?.trim();
  if (mimeType && !isTextLikeMime(mimeType)) {
    throw new Error(
      `File at ${logicalPath} has non-text MIME type (${mimeType}); read tool supports only text files`
    );
  }

  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes);
}

async function readWorkspaceFile(
  url: string,
  space: Space,
  appTree?: AppTree
): Promise<{ data: string | Uint8Array; contentType: string }> {
  const fileVertex = resolveFileVertex(url, space, appTree);
  const logicalPath = getLogicalPath(url);
  const mimeType = (fileVertex.getProperty("mimeType") as string | undefined)?.trim();
  const isText = !mimeType || isTextLikeMime(mimeType);

  if (isText) {
    const bytes = await readBytesFromVertex(space, fileVertex, logicalPath, MAX_TEXT_BYTES);
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(bytes);
    return {
      data: text,
      contentType: mimeType?.includes("charset") ? mimeType : `${mimeType || "text/plain"}; charset=utf-8`
    };
  }

  const bytes = await readBytesFromVertex(space, fileVertex, logicalPath, MAX_FILE_BYTES);
  return {
    data: bytes,
    contentType: mimeType || "application/octet-stream"
  };
}

export function resolveFileVertex(
  url: string,
  space: Space,
  appTree?: AppTree
): Vertex {
  if (!url.startsWith("file:")) {
    throw new Error(`Unsupported URI scheme for workspace file resolver: ${url}`);
  }

  const resolver = space.fileResolver;
  const isWorkspacePath = url.startsWith("file:///");

  if (!isWorkspacePath && !appTree) {
    throw new Error("Chat file operations require a chat tree context");
  }

  try {
    const relativeRootVertex = isWorkspacePath
      ? undefined
      : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);

    return resolver.pathToVertex(url, relativeRootVertex);
  } catch (error) {
    // Provide a helpful error message with the path
    const logicalPath = getLogicalPath(url);
    if (isWorkspacePath) {
      throw new Error(`Workspace file not found at /${logicalPath}`);
    } else {
      throw new Error(`Chat file not found at ${logicalPath}`);
    }
  }
}

function getLogicalPath(url: string): string {
  if (url.startsWith("file:///")) {
    return url.slice("file:///".length);
  } else {
    return url.slice("file:".length);
  }
}

export function createWorkspaceProxyFetch(
  space: Space,
  appTree?: AppTree
): ProxyFetch {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    if (url.startsWith("file:")) {
      const { data, contentType } = await readWorkspaceFile(url, space, appTree);
      // Uint8Array is a valid BodyInit, but TypeScript's types are strict
      const body: BodyInit = typeof data === "string" ? data : (data as BodyInit);

      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": contentType
        }
      });
    }

    // Fallback to environment-level proxy for HTTP/S and sila://
    return proxyFetch(url, init);
  };
}

async function readBytesFromVertex(
  space: Space,
  fileVertex: Vertex,
  logicalPath: string,
  maxBytes: number
): Promise<Uint8Array> {
  const store = space.fileStore;
  if (!store) {
    throw new Error("FileStore is not configured for this space");
  }

  const mutableId = (fileVertex.getProperty("id") as string | undefined)?.trim();
  const hash = (fileVertex.getProperty("hash") as string | undefined)?.trim();

  if (!mutableId && !hash) {
    throw new Error(`File vertex missing id/hash for ${logicalPath}`);
  }

  const bytes = mutableId
    ? await store.getMutable(mutableId)
    : await store.getBytes(hash as string);

  if (bytes.byteLength > maxBytes) {
    const limitName = maxBytes === MAX_TEXT_BYTES ? "read tool" : "proxy fetch";
    throw new Error(
      `File at ${logicalPath} is too large for ${limitName} (size=${bytes.byteLength} bytes, limit=${maxBytes})`
    );
  }

  return bytes;
}

function isTextLikeMime(mime: string): boolean {
  if (mime.startsWith("text/")) return true;
  if (
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime === "application/x-typescript" ||
    mime === "application/markdown"
  ) {
    return true;
  }
  return false;
}
