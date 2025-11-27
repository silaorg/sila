import type { LangToolWithHandler } from "aiwrapper";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";
import { ChatAppData } from "@sila/core";
import { ensureFileParent, ensureChatAssetsRoot } from "./fileUtils";
import type { AgentTool } from "./AgentTool";

export const toolMove: AgentTool = {
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
  getTool(services, appTree): LangToolWithHandler {
    const space = services.space;
    return {
      name: this.name,
      description: this.description!,
      parameters: this.parameters!,
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

        const resolver = space.fileResolver;
        const sourceIsWorkspace = source.startsWith("file:///");

        let sourceVertex: Vertex;
        try {
          if (!sourceIsWorkspace && !appTree) {
            throw new Error("Chat file operations require a chat tree context");
          }

          const sourceRelativeRoot = sourceIsWorkspace
            ? undefined
            : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);

          sourceVertex = resolver.pathToVertex(source, sourceRelativeRoot);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`move: source not found at ${source} (${errorMessage})`);
        }

        const destIsWorkspace = destination.startsWith("file:///");

        let destVertex: Vertex | undefined;
        try {
          if (!destIsWorkspace && !appTree) {
            throw new Error("Chat file operations require a chat tree context");
          }

          const destRelativeRoot = destIsWorkspace
            ? undefined
            : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);

          destVertex = resolver.pathToVertex(destination, destRelativeRoot);
        } catch (error) {
          destVertex = undefined;
        }

        if (destVertex) {
          const destMimeType = destVertex.getProperty("mimeType") as string | undefined;

          if (destMimeType) {
            throw new Error(`move: destination ${destination} is a file, not a folder`);
          }

          const sourceName = sourceVertex.name || "";
          moveVertex(
            sourceVertex,
            sourceVertex.tree,
            destVertex,
            destVertex.tree,
            sourceName
          );
          return `Moved ${source} to ${destination}/${sourceName}`;
        }

        if (destination === "file:" || destination === "file:." || destination === "file:/") {
          if (!appTree) throw new Error("Chat context required");
          const assetsRoot = ensureChatAssetsRoot(appTree);

          const sourceName = sourceVertex.name || "";
          moveVertex(
            sourceVertex,
            sourceVertex.tree,
            assetsRoot,
            appTree.tree,
            sourceName
          );
          return `Moved ${source} to ${destination}/${sourceName}`;
        }

        const { parent: destParentVertex, name: newName } = ensureFileParent(space, appTree, destination);

        const destTree = destination.startsWith("file:///") ? space.tree : appTree!.tree;

        moveVertex(
          sourceVertex,
          sourceVertex.tree,
          destParentVertex,
          destTree,
          newName
        );

        return `Moved ${source} to ${destination}`;
      },
    };
  },
};

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
    const existing = destination.children?.find((c) => c.name === finalName);
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
  const existing = destination.children?.find((c) => c.name === finalName);
  if (existing) {
    throw new Error(`move: destination already contains an item named "${finalName}"`);
  }

  copyVertexRecursive(source, sourceTree, destination, destTree, finalName);

  // Delete source after successful copy
  sourceTree.deleteVertex(source.id);
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
