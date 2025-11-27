import type { LangToolWithHandler } from "aiwrapper";
import type { AppTree } from "../../spaces/AppTree";
import { ChatAppData } from "../../spaces/ChatAppData";
import type { AgentTool } from "./AgentTool";

export const toolRm: AgentTool = {
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
  getTool(services, appTree): LangToolWithHandler {
    const space = services.space;
    return {
      name: this.name,
      description: this.description!,
      parameters: this.parameters!,
      handler: async (args: Record<string, any>): Promise<string> => {
        const { uri } = args;
        if (typeof uri !== "string" || !uri.startsWith("file:")) {
          throw new Error(
            "rm tool only supports file: URIs. For example: file:notes or file:///assets/brand.md"
          );
        }

        const resolver = space.fileResolver;
        const isWorkspacePath = uri.startsWith("file:///");

        let target;
        try {
          if (!isWorkspacePath && !appTree) {
            throw new Error("Chat file operations require a chat tree context");
          }

          const relativeRootVertex = isWorkspacePath
            ? undefined
            : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);

          target = resolver.pathToVertex(uri, relativeRootVertex);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`rm: path not found: ${uri} (${errorMessage})`);
        }

        const scopeRoot = isWorkspacePath
          ? space.rootVertex
          : (appTree?.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH) || null);

        if (isWorkspacePath && target.id === scopeRoot!.id) {
          throw new Error("rm: cannot delete workspace root");
        }

        if (!isWorkspacePath && scopeRoot && target.id === scopeRoot.id) {
          throw new Error("rm: cannot delete chat files root");
        }

        target.tree.deleteVertex(target.id);
        return `Deleted ${uri}`;
      },
    };
  },
};
