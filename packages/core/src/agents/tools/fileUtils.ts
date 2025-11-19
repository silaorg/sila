import { Space } from "../../spaces/Space";
import { AppTree } from "../../spaces/AppTree";
import { Vertex } from "reptree";
import { ChatAppData } from "@sila/core";

export interface ResolvedPath {
  vertex?: Vertex;     // The target vertex if it exists
  parent?: Vertex;     // The parent folder (if path is not root)
  name: string;        // The name of the target (vertex.name or the intended name)
  tree: any;           // RepTree (space.tree or appTree.tree)
  isWorkspace: boolean;
  scopeRoot: Vertex;   // The root of the search (space root or chat assets root)
}

export function resolvePath(
  space: Space,
  appTree: AppTree | undefined,
  uri: string
): ResolvedPath {
  if (!uri.startsWith("file:")) {
    throw new Error(`Invalid URI: ${uri}. Must start with 'file:'`);
  }

  if (uri.startsWith("file:///")) {
    return resolveWorkspacePath(space, uri);
  }

  return resolveChatPath(appTree, uri);
}

function resolveWorkspacePath(space: Space, uri: string): ResolvedPath {
  const path = uri.slice("file:///".length); // "assets/brand.md" or ""
  const segments = path.split("/").filter(Boolean);
  
  const tree = space.tree;
  const scopeRoot = space.rootVertex;

  if (segments.length === 0) {
    // Root of the space
    return {
      vertex: scopeRoot,
      parent: undefined,
      name: scopeRoot.name || "",
      tree,
      isWorkspace: true,
      scopeRoot
    };
  }

  const name = segments[segments.length - 1];
  const parentSegments = segments.slice(0, -1);

  const parent = walkPath(scopeRoot, parentSegments);
  
  if (!parent) {
    // Parent path doesn't exist
    return {
      vertex: undefined,
      parent: undefined, // Cannot determine parent vertex
      name,
      tree,
      isWorkspace: true,
      scopeRoot
    };
  }

  const vertex = parent.children?.find(c => c.name === name);

  return {
    vertex,
    parent,
    name,
    tree,
    isWorkspace: true,
    scopeRoot
  };
}

function resolveChatPath(appTree: AppTree | undefined, uri: string): ResolvedPath {
  if (!appTree) {
    throw new Error("Chat file operations require a chat tree context");
  }

  const rawPath = uri.slice("file:".length);
  const trimmed = rawPath.trim();
  
  const tree = appTree.tree;
  const rootPath = ChatAppData.ASSETS_ROOT_PATH; // "assets"

  // Ensure assets root exists or at least we can try to find it
  let assetsRoot = tree.getVertexByPath(rootPath) as Vertex | undefined;
  
  // If we are just listing/resolving, we might not want to create it yet, 
  // but for consistency usually we assume it's the root. 
  // If it doesn't exist, we can't resolve children.
  
  // Normalize path
  const segments = trimmed.split("/").filter(s => s && s !== "." && s !== "/");
  
  // Handle "file:assets/foo" vs "file:foo" -> both mean inside assets
  if (segments.length > 0 && segments[0] === rootPath) {
    segments.shift();
  }

  // If assetsRoot doesn't exist, and we need it to resolve a path, we effectively have no match.
  // But if we are at the root (segments empty), we might want to return "vertex: undefined" 
  // or we might lazily create it? 
  // Most tools seem to create it if missing (e.g. mkdir, move dest). 
  // `ls` returns empty list if missing. 
  // `rm` throws.
  
  // For `resolvePath`, let's return what we can find.

  if (segments.length === 0) {
    return {
      vertex: assetsRoot,
      parent: undefined,
      name: rootPath,
      tree,
      isWorkspace: false,
      scopeRoot: assetsRoot as Vertex // Might be undefined, handled by caller
    };
  }

  if (!assetsRoot) {
    // Root missing, so child definitely missing
    return {
      vertex: undefined,
      parent: undefined,
      name: segments[segments.length - 1],
      tree,
      isWorkspace: false,
      scopeRoot: assetsRoot as any
    };
  }

  const name = segments[segments.length - 1];
  const parentSegments = segments.slice(0, -1);

  const parent = walkPath(assetsRoot, parentSegments);

  if (!parent) {
    return {
      vertex: undefined,
      parent: undefined,
      name,
      tree,
      isWorkspace: false,
      scopeRoot: assetsRoot
    };
  }

  const vertex = parent.children?.find(c => c.name === name);

  return {
    vertex,
    parent,
    name,
    tree,
    isWorkspace: false,
    scopeRoot: assetsRoot
  };
}

function walkPath(start: Vertex, segments: string[]): Vertex | undefined {
  let current: Vertex | undefined = start;
  for (const seg of segments) {
    if (!current) return undefined;
    const children: Vertex[] = current.children ?? [];
    current = children.find((c: Vertex) => c.name === seg);
  }
  return current;
}

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

