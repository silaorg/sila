import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";

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

      if (uri.startsWith("file:///")) {
        const path = uri.slice("file:///".length); // e.g. "assets/brand.md"
        const segments = path.split("/").filter(Boolean);
        if (segments.length === 0) {
          throw new Error("rm: workspace path is empty");
        }

        const root = space.rootVertex;
        const target = resolveWorkspaceVertex(root, segments);

        // Prevent deleting the root of the space
        if (target.id === root.id) {
          throw new Error("rm: cannot delete workspace root");
        }

        space.tree.deleteVertex(target.id);
        return `Deleted /${segments.join("/")}`;
      }

      // Chat-level: file:...
      if (!appTree) {
        throw new Error("rm: chat delete requires a chat tree context");
      }

      const rawPath = uri.slice("file:".length); // e.g. "notes/doc.md" or "files/notes"
      const trimmed = rawPath.trim();
      if (!trimmed) {
        throw new Error("rm: chat path is empty");
      }

      let segments = trimmed.split("/").filter(Boolean);
      if (segments[0] === "files") {
        segments = segments.slice(1);
      }
      if (segments.length === 0) {
        throw new Error("rm: chat path does not contain a target");
      }

      const filesRoot = appTree.tree.getVertexByPath("files") as Vertex | undefined;
      if (!filesRoot) {
        throw new Error("rm: chat files root not found");
      }

      const target = resolveChatVertex(filesRoot, segments);

      // Prevent deleting the 'files' root
      if (target.id === filesRoot.id) {
        throw new Error("rm: cannot delete chat files root");
      }

      appTree.tree.deleteVertex(target.id);
      return `Deleted files/${segments.join("/")}`;
    },
  };
}

function resolveWorkspaceVertex(root: Vertex, segments: string[]): Vertex {
  let current: Vertex | undefined = root;

  for (const seg of segments) {
    const children: Vertex[] = current?.children ?? [];
    const next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);
    if (!next) {
      throw new Error(`rm: workspace path not found at /${segments.join("/")}`);
    }
    current = next;
  }

  return current!;
}

function resolveChatVertex(filesRoot: Vertex, segments: string[]): Vertex {
  let current: Vertex | undefined = filesRoot;

  for (const seg of segments) {
    const children: Vertex[] = current?.children ?? [];
    const next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);
    if (!next) {
      throw new Error(
        `rm: chat path not found at files/${segments.join("/")}`
      );
    }
    current = next;
  }

  return current!;
}


