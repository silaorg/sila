import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";
import { ChatAppData } from "@sila/core";

export function getToolMove(space: Space, appTree?: AppTree): LangToolWithHandler {
  return {
    name: "move",
    description:
      "Move a file or folder from one location to another. Supports moving between chat files (file:) and workspace assets (file:///). Can move files and folders within the same context or between contexts.",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description:
            "Source path to move from. Use file: for chat files (e.g. file:notes/doc.md) and file:///assets/... for workspace assets.",
        },
        destination: {
          type: "string",
          description:
            "Destination path to move to. Use file: for chat files (e.g. file:archive/doc.md) and file:///assets/... for workspace assets. If destination is a folder, the item will be moved into that folder.",
        },
      },
      required: ["source", "destination"],
    },
    handler: async (args: Record<string, any>): Promise<string> => {
      const { source, destination } = args;
      if (typeof source !== "string" || !source.startsWith("file:")) {
        throw new Error(
          "move tool only supports file: URIs for source. For example: file:notes/doc.md or file:///assets/doc.md"
        );
      }
      if (typeof destination !== "string" || !destination.startsWith("file:")) {
        throw new Error(
          "move tool only supports file: URIs for destination. For example: file:archive/doc.md or file:///assets/doc.md"
        );
      }

      // Resolve source
      const sourceResolved = resolvePath(space, appTree, source, "source");
      // Resolve destination
      const destResolved = resolvePath(space, appTree, destination, "destination");

      // Check if source exists
      if (!sourceResolved.vertex) {
        throw new Error(`move: source not found at ${source}`);
      }

      // Check if destination folder exists (if destination is a folder path)
      if (!destResolved.vertex) {
        // Special case: if destination is "file:" (chat files root), create it if needed
        if (destination === "file:" || destination === "file:." || destination === "file:/") {
          if (!appTree) {
            throw new Error("move: chat files root requires a chat tree context");
          }
          let filesRoot = appTree.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH) as Vertex | undefined;
          if (!filesRoot) {
            filesRoot = appTree.tree.root!.newNamedChild(ChatAppData.ASSETS_ROOT_PATH) as Vertex;
            filesRoot.setProperty("createdAt", Date.now());
          }
          const sourceName = sourceResolved.vertex.name || getLastSegment(source);
          moveVertex(
            sourceResolved.vertex,
            sourceResolved.tree,
            filesRoot,
            appTree.tree,
            sourceName
          );
          return `Moved ${source} to ${destination}/${sourceName}`;
        }

        // Destination doesn't exist - resolve (and if needed, create) parent folder
        const parentUri = getParentPath(destination);
        let destParentResolved = resolvePath(space, appTree, parentUri, "destination parent");
        let destParentVertex = destParentResolved.vertex;
        let destParentTree = destParentResolved.tree;

        if (!destParentVertex) {
          // Auto-create missing parent folder chain
          if (destination.startsWith("file:///")) {
            // Workspace-level: ensure folders under space root, e.g. file:///assets/flow
            const path = parentUri.slice("file:///".length);
            const segments = path.split("/").filter(Boolean);
            const root = space.rootVertex;
            destParentVertex = ensureWorkspaceFolder(root, segments);
            destParentTree = space.tree;
          } else {
            // Chat-level: ensure folders under chat assets root
            if (!appTree) {
              throw new Error("move: chat folder creation requires a chat tree context");
            }
            const rawPath = parentUri.slice("file:".length); // e.g. "" or "assets/notes"
            const trimmed = rawPath.trim();
            let segments = trimmed ? trimmed.split("/").filter(Boolean) : [];
            const rootPath = ChatAppData.ASSETS_ROOT_PATH;

            // Ensure assets root exists
            let assetsRoot = appTree.tree.getVertexByPath(rootPath) as Vertex | undefined;
            if (!assetsRoot) {
              assetsRoot = appTree.tree.root!.newNamedChild(rootPath) as Vertex;
              assetsRoot.setProperty("createdAt", Date.now());
            }

            // Allow user to prefix with assets root (file:assets/notes)
            if (segments[0] === rootPath) {
              segments = segments.slice(1);
            }

            destParentVertex = ensureChatFolder(assetsRoot, segments);
            destParentTree = appTree.tree;
          }
        } else if (destParentVertex.getProperty("mimeType")) {
          throw new Error(`move: destination folder not found for ${destination}`);
        }

        // Destination is a new name in the parent folder
        const newName = getLastSegment(destination);
        moveVertex(
          sourceResolved.vertex,
          sourceResolved.tree,
          destParentVertex,
          destParentTree,
          newName
        );
        return `Moved ${source} to ${destination}`;
      }

      // Destination exists - check if it's a folder
      const destMimeType = destResolved.vertex.getProperty("mimeType") as string | undefined;
      if (destMimeType) {
        // Destination is a file, not a folder - error
        throw new Error(`move: destination ${destination} is a file, not a folder`);
      }

      // Destination is a folder - move source into it
      const sourceName = sourceResolved.vertex.name || getLastSegment(source);
      moveVertex(
        sourceResolved.vertex,
        sourceResolved.tree,
        destResolved.vertex,
        destResolved.tree,
        sourceName
      );
      return `Moved ${source} to ${destination}/${sourceName}`;
    },
  };
}

interface ResolvedPath {
  vertex: Vertex | null;
  tree: any; // RepTree
  isWorkspace: boolean;
}

function resolvePath(
  space: Space,
  appTree: AppTree | undefined,
  uri: string,
  context: string
): ResolvedPath {
  if (uri.startsWith("file:///")) {
    // Workspace-level path from space root, e.g. file:///assets/brand.md
    const path = uri.slice("file:///".length).trim(); // "" or "assets/..."
    if (!path) {
      // Root of the space
      return { vertex: space.rootVertex, tree: space.tree, isWorkspace: true };
    }

    // Use getVertexByPath which returns undefined when path is missing
    const target = space.getVertexByPath(path) as Vertex | undefined;
    return { vertex: target ?? null, tree: space.tree, isWorkspace: true };
  }

  // Chat-level path
  if (!appTree) {
    throw new Error(`move: ${context} requires a chat tree context for file: paths`);
  }

  const rawPath = uri.slice("file:".length);
  const trimmed = rawPath.trim();
  const tree = appTree.tree;
  const rootPath = ChatAppData.ASSETS_ROOT_PATH;

  // Resolve chat assets root (logical file root for the current chat)
  const assetsRoot = tree.getVertexByPath(rootPath) as Vertex | undefined;

  if (trimmed === "" || trimmed === "." || trimmed === "/") {
    // Root listing for chat files: corresponds to the assets root
    return { vertex: assetsRoot || null, tree, isWorkspace: false };
  }

  // Normalize local path:
  // - If user already included the assets root (file:assets/...), keep it
  // - Otherwise, treat it as relative to the assets root (file:doc.md → assets/doc.md)
  const stripped = trimmed.replace(/^\/+/, "");
  let logicalPath: string;
  if (stripped === rootPath || stripped.startsWith(`${rootPath}/`)) {
    logicalPath = stripped;
  } else {
    logicalPath = `${rootPath}/${stripped}`;
  }

  const target = tree.getVertexByPath(logicalPath) as Vertex | undefined;
  if (!target) {
    return { vertex: null, tree, isWorkspace: false };
  }

  return { vertex: target, tree, isWorkspace: false };
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

function getParentPath(uri: string): string {
  if (uri.startsWith("file:///")) {
    const path = uri.slice("file:///".length);
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) {
      return "file:///";
    }
    segments.pop();
    return segments.length === 0 ? "file:///" : `file:///${segments.join("/")}`;
  }
  // file: path
  const path = uri.slice("file:".length);
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "file:";
  }
  segments.pop();
  return segments.length === 0 ? "file:" : `file:${segments.join("/")}`;
}

function getLastSegment(uri: string): string {
  if (uri.startsWith("file:///")) {
    const path = uri.slice("file:///".length);
    const segments = path.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  }
  const path = uri.slice("file:".length);
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

function moveVertex(
  source: Vertex,
  sourceTree: any,
  destination: Vertex,
  destTree: any,
  newName?: string
): void {
  // Check if moving to self or into self
  if (source.id === destination.id) {
    throw new Error("move: cannot move item into itself");
  }

  // Check if destination is a descendant of source
  let current: Vertex | undefined = destination;
  while (current) {
    if (current.id === source.id) {
      throw new Error("move: cannot move folder into its own descendant");
    }
    current = current.parent;
  }

  // If same tree, use moveTo
  if (sourceTree === destTree) {
    const finalName = newName || source.name || "item";
    // Check if name conflicts
    const existing = destination.children.find((c) => c.name === finalName);
    if (existing && existing.id !== source.id) {
      throw new Error(`move: destination already contains an item named "${finalName}"`);
    }
    source.moveTo(destination);
    if (newName && source.name !== newName) {
      source.setProperty("name", newName);
    }
    return;
  }

  // Different trees - need to copy recursively
  const finalName = newName || source.name || "item";
  // Check if name conflicts
  const existing = destination.children.find((c) => c.name === finalName);
  if (existing) {
    throw new Error(`move: destination already contains an item named "${finalName}"`);
  }

  copyVertexRecursive(source, sourceTree, destination, destTree, finalName);

  // Delete source after successful copy
  sourceTree.deleteVertex(source.id);
}

function ensureWorkspaceFolder(root: Vertex, segments: string[]): Vertex {
  let current: Vertex | undefined = root;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const children: Vertex[] = current?.children ?? [];
    let next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);

    if (!next) {
      next = current!.newNamedChild(seg, {
        createdAt: Date.now(),
      }) as Vertex;
    } else {
      const mimeType = next.getProperty("mimeType") as string | undefined;
      if (mimeType) {
        throw new Error(
          `move: path segment '${seg}' is a file, not a folder`
        );
      }
    }
    current = next;
  }

  return current!;
}

function ensureChatFolder(root: Vertex, segments: string[]): Vertex {
  let current: Vertex | undefined = root;

  for (const seg of segments) {
    const children: Vertex[] = current?.children ?? [];
    let next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);

    if (!next) {
      next = current!.newNamedChild(seg, {
        createdAt: Date.now(),
      }) as Vertex;
    } else {
      const mimeType = next.getProperty("mimeType") as string | undefined;
      if (mimeType) {
        throw new Error(
          `move: path segment '${seg}' is a file, not a folder`
        );
      }
    }
    current = next;
  }

  return current!;
}

function copyVertexRecursive(
  source: Vertex,
  sourceTree: any,
  destination: Vertex,
  destTree: any,
  name: string
): Vertex {
  // Copy all properties except name (which we set explicitly)
  const props: Record<string, any> = {};
  const sourceProps = sourceTree.getVertexProperties(source.id);
  for (const prop of sourceProps) {
    if (prop.key !== "name" && prop.key !== "_n") {
      props[prop.key] = prop.value;
    }
  }

  // Create new vertex in destination tree using newNamedChild
  const newVertex = destination.newNamedChild(name, props);

  // If source is a folder (no mimeType), copy all children recursively
  const mimeType = source.getProperty("mimeType") as string | undefined;
  if (!mimeType) {
    const children = source.children || [];
    for (const child of children) {
      const childName = child.name || "item";
      copyVertexRecursive(child, sourceTree, newVertex, destTree, childName);
    }
  }

  return newVertex;
}

