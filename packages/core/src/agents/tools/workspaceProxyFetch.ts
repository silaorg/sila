import type { ProxyFetch } from "../../utils/proxyFetch";
import { proxyFetch } from "../../utils";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";

const MAX_TEXT_BYTES = 1024 * 1024; // 1 MB safety limit for tool reads

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
  if (!url.startsWith("file:")) {
    throw new Error(`Unsupported URI scheme for workspace file resolver: ${url}`);
  }

  if (url.startsWith("file:///")) {
    // Workspace-level path from space root, e.g. file:///assets/brand.md
    const pathWithoutPrefix = url.slice("file:///".length); // "assets/brand.md"
    if (!pathWithoutPrefix) {
      throw new Error(`Workspace file path is empty in URI: ${url}`);
    }
    const root = space.rootVertex;
    const fileVertex = root.tree.getVertexByPath(pathWithoutPrefix) as Vertex | undefined;
    if (!fileVertex) {
      throw new Error(`Workspace file not found at /${pathWithoutPrefix}`);
    }
    return await readTextFromFileVertex(space, fileVertex, `/${pathWithoutPrefix}`);
  }

  // Chat-level path relative to current chat AppTree root, e.g. file:assets/document.md
  if (!appTree) {
    throw new Error(`Chat file URI requires a chat tree context: ${url}`);
  }

  const rawPath = url.slice("file:".length); // e.g. "assets/document.md" or "notes/doc.md"
  const normalizedPath =
    rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
  if (!normalizedPath) {
    throw new Error(`Chat file path is empty in URI: ${url}`);
  }

  const tree = appTree.tree;
  const fileVertex = tree.getVertexByPath(normalizedPath) as Vertex | undefined;

  if (!fileVertex) {
    throw new Error(`Chat file not found at ${normalizedPath}`);
  }

  return await readTextFromFileVertex(
    space,
    fileVertex,
    normalizedPath
  );
}

export function createWorkspaceProxyFetch(
  space: Space,
  appTree?: AppTree
): ProxyFetch {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    if (url.startsWith("file:")) {
      const text = await resolveWorkspaceFileUrl(url, space, appTree);
      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    // Fallback to environment-level proxy for HTTP/S and sila://
    return proxyFetch(url, init);
  };
}

async function readTextFromFileVertex(
  space: Space,
  fileVertex: Vertex,
  logicalPath: string
): Promise<string> {
  const store = space.getFileStore();
  if (!store) {
    throw new Error("FileStore is not configured for this space");
  }

  const mutableId = (fileVertex.getProperty("id") as string | undefined)?.trim();
  const hash = (fileVertex.getProperty("hash") as string | undefined)?.trim();

  if (!mutableId && !hash) {
    throw new Error(`File vertex missing id/hash for ${logicalPath}`);
  }

  const mimeType = fileVertex.getProperty("mimeType") as string | undefined;
  if (mimeType && !isTextLikeMime(mimeType)) {
    throw new Error(
      `File at ${logicalPath} has non-text MIME type (${mimeType}); read tool supports only text files`
    );
  }

  const bytes = mutableId
    ? await store.getMutable(mutableId)
    : await store.getBytes(hash as string);
  if (bytes.byteLength > MAX_TEXT_BYTES) {
    throw new Error(
      `File at ${logicalPath} is too large for read tool (size=${bytes.byteLength} bytes, limit=${MAX_TEXT_BYTES})`
    );
  }

  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes);
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


