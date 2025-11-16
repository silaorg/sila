import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";

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

      if (uri.startsWith("file:///")) {
        // Workspace-level folder under space root, e.g. file:///assets/docs
        const path = uri.slice("file:///".length); // "assets/docs"
        const segments = path.split("/").filter(Boolean);
        if (segments.length === 0) {
          throw new Error("mkdir: workspace path is empty");
        }

        const root = space.rootVertex;
        const target = ensureWorkspaceFolder(root, segments);
        return `Created directory at /${segments.join("/")}`;
      }

      // Chat-level folder under current chat 'files' root
      if (!appTree) {
        throw new Error("mkdir: chat folder creation requires a chat tree context");
      }

      const rawPath = uri.slice("file:".length); // e.g. "notes/docs" or "files/notes"
      const trimmed = rawPath.trim();
      if (!trimmed) {
        throw new Error("mkdir: chat path is empty");
      }

      let segments = trimmed.split("/").filter(Boolean);
      // Allow the user to prefix with "files/"
      if (segments[0] === "files") {
        segments = segments.slice(1);
      }
      if (segments.length === 0) {
        throw new Error("mkdir: chat path does not contain a folder name");
      }

      let filesRoot = appTree.tree.getVertexByPath("files") as Vertex | undefined;
      if (!filesRoot) {
        filesRoot = appTree.tree.root!.newNamedChild("files") as Vertex;
        filesRoot.setProperty("createdAt", Date.now());
      }

      ensureChatFolder(filesRoot, segments);
      return `Created directory at files/${segments.join("/")}`;
    },
  };
}

function ensureWorkspaceFolder(root: Vertex, segments: string[]): Vertex {
  let current: Vertex | undefined = root;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const children: Vertex[] = current?.children ?? [];
    let next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);

    if (!next) {
      // Only allow creating under existing folders (no files)
      next = current!.newNamedChild(seg, {
        createdAt: Date.now(),
      }) as Vertex;
    } else {
      const mimeType = next.getProperty("mimeType") as string | undefined;
      if (mimeType) {
        throw new Error(
          `mkdir: path segment '${seg}' is a file, not a folder`
        );
      }
    }
    current = next;
  }

  return current!;
}

function ensureChatFolder(filesRoot: Vertex, segments: string[]): Vertex {
  let current: Vertex | undefined = filesRoot;

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
          `mkdir: path segment '${seg}' is a file, not a folder`
        );
      }
    }
    current = next;
  }

  return current!;
}


