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
 * - Workspace-level: file:///assets/brand.md   (from Space.rootVertex)
 * - Chat-level:      file:document.md         (from appTree 'files' root)
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
    const path = url.slice("file:///".length); // "assets/brand.md"
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) {
      throw new Error(`Workspace file path is empty in URI: ${url}`);
    }
    const root = space.rootVertex;
    const fileVertex = walkByName(root, segments, `Workspace file not found at /${segments.join("/")}`);
    return await readTextFromFileVertex(space, fileVertex, `/${segments.join("/")}`);
  }

  // Chat-level path relative to current chat 'files' root, e.g. file:document.md
  if (!appTree) {
    throw new Error(`Chat file URI requires a chat tree context: ${url}`);
  }

  const rawPath = url.slice("file:".length); // e.g. "document.md" or "notes/doc.md"
  const segments = rawPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Chat file path is empty in URI: ${url}`);
  }

  const filesRoot = appTree.tree.getVertexByPath("files") as Vertex | undefined;
  if (!filesRoot) {
    throw new Error("Chat files root not found (no 'files' vertex in chat tree)");
  }

  // Allow both "document.md" and "files/document.md"
  const effectiveSegments =
    segments[0] === "files" ? segments.slice(1) : segments;

  const fileVertex = walkByName(
    filesRoot,
    effectiveSegments,
    `Chat file not found at files/${effectiveSegments.join("/")}`
  );
  return await readTextFromFileVertex(
    space,
    fileVertex,
    `files/${effectiveSegments.join("/")}`
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

function walkByName(
  start: Vertex,
  segments: string[],
  notFoundMessage: string
): Vertex {
  let current: Vertex | undefined = start;
  for (const seg of segments) {
    const children: Vertex[] = current?.children ?? [];
    const next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);
    if (!next || !current) {
      throw new Error(notFoundMessage);
    }
    current = next;
  }
  return current!;
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

  const hash = (fileVertex.getProperty("hash") as string | undefined)?.trim();
  if (!hash) {
    throw new Error(`File vertex missing hash for ${logicalPath}`);
  }

  const mimeType = fileVertex.getProperty("mimeType") as string | undefined;
  if (mimeType && !isTextLikeMime(mimeType)) {
    throw new Error(
      `File at ${logicalPath} has non-text MIME type (${mimeType}); read tool supports only text files`
    );
  }

  const bytes = await store.getBytes(hash);
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


