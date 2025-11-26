import { Vertex } from "reptree";
import type { Space } from "../Space";
import type { AppTree } from "../AppTree";
import { ChatAppData } from "../ChatAppData";

export interface ParsedFileUri {
  isWorkspacePath: boolean;
  segments: string[];
}

/**
 * Normalize and split a file URI into path segments.
 * Removes the chat assets prefix when present for chat-scoped paths.
 */
export function parseFileUri(uri: string): ParsedFileUri {
  if (!uri.startsWith("file:")) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  const isWorkspacePath = uri.startsWith("file:///");
  const raw =
    uri.slice(isWorkspacePath ? "file:///".length : "file:".length).trim();

  const segments = raw
    .split("/")
    .filter((s) => s && s !== "." && s !== "/");

  // For chat paths strip leading assets/ if present, since callers already anchor at assets root.
  if (!isWorkspacePath && segments[0] === ChatAppData.ASSETS_ROOT_PATH) {
    segments.shift();
  }

  return { isWorkspacePath, segments };
}

export function ensureChatAssetsRoot(appTree: AppTree): Vertex {
  const rootPath = ChatAppData.ASSETS_ROOT_PATH;
  let assetsRoot = appTree.tree.getVertexByPath(rootPath) as
    | Vertex
    | undefined;

  if (!assetsRoot) {
    assetsRoot = appTree.tree.root!.newNamedChild(rootPath) as Vertex;
    assetsRoot.setProperty("createdAt", Date.now());
  }

  return assetsRoot;
}

export function ensureFolder(root: Vertex, segments: string[]): Vertex {
  let current: Vertex = root;

  for (const seg of segments) {
    const children: Vertex[] = current.children ?? [];
    let next: Vertex | undefined = children.find(
      (c: Vertex) => c.name === seg,
    );

    if (!next) {
      next = current.newNamedChild(seg, {
        createdAt: Date.now(),
      }) as Vertex;
    } else {
      const mimeType = next.getProperty("mimeType") as string | undefined;
      if (mimeType) {
        throw new Error(`Path segment '${seg}' is a file, not a folder`);
      }
    }
    current = next;
  }

  return current;
}

export function getRootForPath(
  space: Space,
  appTree: AppTree | undefined,
  isWorkspacePath: boolean,
): Vertex {
  if (isWorkspacePath) {
    return space.rootVertex;
  }

  if (!appTree) {
    throw new Error("Chat file operations require a chat tree context");
  }

  return ensureChatAssetsRoot(appTree);
}

export function resolvePathFromRoot(
  root: Vertex,
  segments: string[],
  pathLabel?: string,
): Vertex {
  let current: Vertex | undefined = root;
  if (segments.length === 0) {
    return root;
  }

  for (const seg of segments) {
    if (!current) {
      throw new Error(
        `Path traversal failed${pathLabel ? ` for ${pathLabel}` : ""}`,
      );
    }
    const children: Vertex[] = current.children ?? [];
    current = children.find((c: Vertex) => c.name === seg);
    if (!current) {
      throw new Error(
        `Path traversal failed${pathLabel ? ` for ${pathLabel}` : ""}`,
      );
    }
  }

  return current;
}

export function vertexToFileUri(space: Space, vertex: Vertex): string {
  const isWorkspaceVertex =
    vertex.tree.root?.id === space?.tree.root?.id;
  const pathPrefix = isWorkspaceVertex ? "file:///" : "file:";

  const segments: string[] = [];
  let current: Vertex | undefined = vertex;

  while (current && current.id !== vertex.tree.root?.id) {
    if (current.name) {
      segments.unshift(current.name);
    }
    current = current.parent as Vertex | undefined;
  }

  if (segments.length === 0) {
    throw new Error("Cannot build path: vertex is at space root");
  }

  return `${pathPrefix}${segments.join("/")}`;
}
