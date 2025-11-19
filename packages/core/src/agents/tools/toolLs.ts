import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";
import { resolvePath } from "./fileUtils";

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

      // Use unified path resolution
      const resolved = resolvePath(space, appTree, uri);

      // Special handling for chat root: if assets root doesn't exist, return empty list instead of error
      if (!resolved.isWorkspace && !resolved.scopeRoot && !resolved.vertex) {
        return [];
      }

      if (!resolved.vertex) {
        throw new Error(`Path not found: ${uri}`);
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

      return listChildren(resolved.vertex, basePath);
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
