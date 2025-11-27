import type { LangToolWithHandler } from "aiwrapper";
import type { AppTree } from "../../spaces/AppTree";
import { ensurePath } from "./fileUtils";
import type { AgentTool } from "./AgentTool";

export const toolMkdir: AgentTool = {
  name: "mkdir",
  description:
    "Create a directory in the current workspace. Use 'file:folder' for chat folders and 'file:///assets/folder' for workspace assets.",
  parameters: {
    type: "object",
    properties: {
      uri: {
        type: "string",
        description:
          "Directory path to create. Use file: for chat files (e.g. file:notes/projects) and file:///assets/... for workspace assets.",
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
            "mkdir tool only supports file: URIs. For example: file:notes or file:///assets/docs"
          );
        }

        await ensurePath(space, appTree, uri);
        return `Created directory at ${uri}`;
      },
    };
  },
};
