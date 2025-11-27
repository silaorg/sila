import type { LangToolWithHandler } from "aiwrapper";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";
import { ChatAppData } from "../../spaces/ChatAppData";
import type { AgentTool } from "./AgentTool";

type LsEntryKind = "file" | "folder";

interface LsEntry {
  name: string;
  kind: LsEntryKind;
  path: string;
  mimeType?: string;
  size?: number;
}

export const toolLs: AgentTool = {
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
  getTool(services, appTree): LangToolWithHandler {
    const space = services.space;
    return {
      name: this.name,
      description: this.description!,
      parameters: this.parameters!,
      handler: async (args: Record<string, any>): Promise<LsEntry[]> => {
        const { uri } = args;
        if (typeof uri !== "string" || !uri.startsWith("file:")) {
          throw new Error(
            "ls tool only supports file: URIs. For example: file: or file:///assets"
          );
        }

        const resolver = space.fileResolver;
        const isWorkspacePath = uri.startsWith("file:///");

        let folderVertex: Vertex;
        try {
          if (!isWorkspacePath && !appTree) {
            throw new Error("Chat file operations require a chat tree context");
          }

          const pathAfterPrefix = isWorkspacePath
            ? uri.slice("file:///".length)
            : uri.slice("file:".length);

          if (pathAfterPrefix === "" || pathAfterPrefix === "/") {
            if (isWorkspacePath) {
              folderVertex = space.rootVertex;
            } else {
              const assetsRoot = appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
              if (!assetsRoot) {
                return [];
              }
              folderVertex = assetsRoot;
            }
          } else {
            const relativeRootVertex = isWorkspacePath
              ? undefined
              : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);

            folderVertex = resolver.pathToVertex(uri, relativeRootVertex);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Path not found: ${uri} (${errorMessage})`);
        }

        let basePath = uri.slice(uri.indexOf(":") + 1);
        if (basePath.startsWith("//")) {
          basePath = basePath.slice(2);
        }
        if (basePath.length > 1 && basePath.endsWith("/")) {
          basePath = basePath.slice(0, -1);
        }
        if (basePath === "") basePath = "/";

        return listChildren(folderVertex, basePath);
      },
    };
  },
};

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
