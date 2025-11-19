import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { resolvePath } from "./fileUtils";

export function getToolRm(space: Space, appTree?: AppTree): LangToolWithHandler {
  return {
    name: "rm",
    description:
      "Delete a file or directory in the current workspace. Use 'file:assets' for chat files/folders and 'file:///assets/...' for workspace assets.",
    parameters: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description:
            "Path to delete. Use file: for chat files/folders (e.g. file:notes or file:notes/doc.md) and file:///assets/... for workspace assets.",
        },
      },
      required: ["uri"],
    },
    handler: async (args: Record<string, any>): Promise<string> => {
      const { uri } = args;
      if (typeof uri !== "string" || !uri.startsWith("file:")) {
        throw new Error(
          "rm tool only supports file: URIs. For example: file:notes or file:///assets/brand.md"
        );
      }

      const resolved = resolvePath(space, appTree, uri);
      
      if (!resolved.vertex) {
        throw new Error(`rm: path not found: ${uri}`);
      }
      
      const target = resolved.vertex;

      // Prevent deleting the workspace root
      if (resolved.isWorkspace && target.id === resolved.scopeRoot.id) {
         throw new Error("rm: cannot delete workspace root");
      }

      // Prevent deleting the chat assets root
      if (!resolved.isWorkspace && resolved.scopeRoot && target.id === resolved.scopeRoot.id) {
        throw new Error("rm: cannot delete chat files root");
      }

      resolved.tree.deleteVertex(target.id);
      return `Deleted ${uri}`;
    },
  };
}
