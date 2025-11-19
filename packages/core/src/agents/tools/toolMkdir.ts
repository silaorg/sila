import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { ensurePath } from "./fileUtils";

export function getToolMkdir(space: Space, appTree?: AppTree): LangToolWithHandler {
  return {
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
}
