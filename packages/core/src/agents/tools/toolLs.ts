import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";
import { FileResolver } from "../../spaces/files/FileResolver";
import { ChatAppData } from "../../spaces/ChatAppData";

type LsEntryKind = "file" | "folder";

interface LsEntry {
  name: string;
  kind: LsEntryKind;
  path: string;
  mimeType?: string;
  size?: number;
}

export function getToolLs(space: Space, appTree?: AppTree): LangToolWithHandler {
  return {
    name: "ls",
    description:
      "List files and folders in the current workspace. Use 'file:...' for chat files and 'file:///assets/...' for workspace assets.",
    parameters: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description:
            "Path to list. Use file: for chat files (e.g. file:notes) and file:///assets for workspace assets.",
        },
      },
      required: ["uri"],
    },
    handler: async (args: Record<string, any>): Promise<LsEntry[]> => {
      const { uri } = args;
      if (typeof uri !== "string" || !uri.startsWith("file:")) {
        throw new Error(
          "ls tool only supports file: URIs. For example: file: or file:///assets"
        );
      }

      // Use FileResolver.pathToVertex
      const resolver = new FileResolver(space);
      const isWorkspacePath = uri.startsWith("file:///");
      
      let folderVertex: Vertex;
      try {
        if (!isWorkspacePath && !appTree) {
          throw new Error("Chat file operations require a chat tree context");
        }
        
        // Handle empty path (just "file:" or "file:///")
        const pathAfterPrefix = isWorkspacePath 
          ? uri.slice("file:///".length)
          : uri.slice("file:".length);
        
        if (pathAfterPrefix === "" || pathAfterPrefix === "/") {
          // Empty path - return root
          if (isWorkspacePath) {
            folderVertex = space.rootVertex;
          } else {
            const assetsRoot = appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
            // Special handling: if assets root doesn't exist, return empty list instead of error
            if (!assetsRoot) {
              return [];
            }
            folderVertex = assetsRoot;
          }
        } else {
          // Non-empty path - resolve normally
          const relativeRootVertex = isWorkspacePath 
            ? undefined 
            : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
          
          folderVertex = resolver.pathToVertex(uri, relativeRootVertex);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Path not found: ${uri} (${errorMessage})`);
      }

      // Determine logical path for display
      // If resolved.name is the root name (e.g. "assets"), we might want to show relative paths from there?
      // The original implementation constructed paths.
      // If we listed "file:assets/foo", the children paths were "assets/foo/child".
      
      // Let's reconstruct the path from the URI or from vertex structure?
      // URI is safer to match user expectation.
      let basePath = uri.slice(uri.indexOf(":") + 1);
      if (basePath.startsWith("//")) {
        basePath = basePath.slice(2); // /assets/...
      }
      // Ensure basePath doesn't end with / unless it is just "/"
      if (basePath.length > 1 && basePath.endsWith("/")) {
        basePath = basePath.slice(0, -1);
      }
      if (basePath === "") basePath = "/"; // For file:/// -> /

      return listChildren(folderVertex, basePath);
    },
  };
}

function listChildren(folder: Vertex, basePath: string): LsEntry[] {
  const entries: LsEntry[] = [];
  const children: Vertex[] = folder.children ?? [];
  for (const child of children) {
    const mimeType = child.getProperty("mimeType") as string | undefined;
    const size = child.getProperty("size") as number | undefined;
    const isFolder = mimeType === undefined;
    const kind: LsEntryKind = isFolder ? "folder" as const : "file" as const;
    const name = child.name ?? "";
    
    // Construct path relative to the listing root
    const path = basePath === "/" 
      ? `/${name}` 
      : `${basePath}/${name}`;

    entries.push({
      name,
      kind,
      path,
      mimeType: isFolder ? undefined : mimeType,
      size: isFolder ? undefined : size,
    });
  }
  return entries;
}
