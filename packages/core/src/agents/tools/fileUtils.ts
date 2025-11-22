import { Space } from "../../spaces/Space";
import { AppTree } from "../../spaces/AppTree";
import { Vertex } from "reptree";
import { ChatAppData } from "@sila/core";

/**
 * Ensures that a folder path exists, creating intermediate folders as needed.
 * Returns the final folder vertex.
 */
export function ensureFolder(root: Vertex, segments: string[]): Vertex {
  let current: Vertex = root;

  for (const seg of segments) {
    const children: Vertex[] = current.children ?? [];
    let next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);

    if (!next) {
      // Create folder
      next = current.newNamedChild(seg, {
        createdAt: Date.now(),
      }) as Vertex;
    } else {
      // Verify it's a folder
      const mimeType = next.getProperty("mimeType") as string | undefined;
      if (mimeType) {
        throw new Error(`Path segment '${seg}' is a file, not a folder`);
      }
    }
    current = next;
  }

  return current;
}

/**
 * Ensures the chat assets root exists and returns it.
 */
export function ensureChatAssetsRoot(appTree: AppTree): Vertex {
  const rootPath = ChatAppData.ASSETS_ROOT_PATH;
  let assetsRoot = appTree.tree.getVertexByPath(rootPath) as Vertex | undefined;
  
  if (!assetsRoot) {
    assetsRoot = appTree.tree.root!.newNamedChild(rootPath) as Vertex;
    assetsRoot.setProperty("createdAt", Date.now());
  }
  
  return assetsRoot;
}

export function inferTextMimeFromPath(path: string): string | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
  if (lower.endsWith(".ts")) return "application/x-typescript";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".svelte")) return "text/html"; // Treat as text
  
  // Detect common binary formats to reject them
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  
  return undefined;
}

export function validateTextMimeType(mimeType: string): void {
  if (!mimeType.startsWith("text/") && mimeType !== "application/json" && mimeType !== "application/javascript" && mimeType !== "application/x-typescript") {
    throw new Error(
      `Operation only supported for text files (got mimeType='${mimeType}')`
    );
  }
}

export function ensureFileParent(
  space: Space,
  appTree: AppTree | undefined,
  uri: string
): { parent: Vertex; name: string } {
  if (!uri.startsWith("file:")) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  let root: Vertex;
  let segments: string[];

  if (uri.startsWith("file:///")) {
    root = space.rootVertex;
    const path = uri.slice("file:///".length);
    segments = path.split("/").filter(Boolean);
  } else {
    if (!appTree) throw new Error("Chat context required");
    root = ensureChatAssetsRoot(appTree);
    const rawPath = uri.slice("file:".length).trim();
    segments = rawPath.split("/").filter(s => s && s !== "." && s !== "/");
    if (segments.length > 0 && segments[0] === ChatAppData.ASSETS_ROOT_PATH) {
      segments.shift();
    }
  }

  if (segments.length === 0) {
    throw new Error("Path is empty or is root");
  }

  const name = segments[segments.length - 1];
  const parentSegments = segments.slice(0, -1);
  const parent = ensureFolder(root, parentSegments);

  return { parent, name };
}

export function ensurePath(
  space: Space,
  appTree: AppTree | undefined,
  uri: string
): Vertex {
  if (!uri.startsWith("file:")) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  let root: Vertex;
  let segments: string[];

  if (uri.startsWith("file:///")) {
    root = space.rootVertex;
    const path = uri.slice("file:///".length);
    segments = path.split("/").filter(Boolean);
  } else {
    if (!appTree) throw new Error("Chat context required");
    root = ensureChatAssetsRoot(appTree);
    const rawPath = uri.slice("file:".length).trim();
    segments = rawPath.split("/").filter(s => s && s !== "." && s !== "/");
    if (segments.length > 0 && segments[0] === ChatAppData.ASSETS_ROOT_PATH) {
      segments.shift();
    }
  }

  if (segments.length === 0) {
    throw new Error("Path is empty or is root");
  }

  return ensureFolder(root, segments);
}

