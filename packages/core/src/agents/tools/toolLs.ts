import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";
import { ChatAppData } from "@sila/core";

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

      // Workspace-level: file:///assets or file:///assets/brand
      if (uri.startsWith("file:///")) {
        const path = uri.slice("file:///".length); // e.g. "assets" or "assets/brand"
        const segments = path.split("/").filter(Boolean);
        const root = space.rootVertex;
        const target = segments.length === 0
          ? root
          : walkByName(root, segments, `Workspace path not found at /${segments.join("/")}`);
        return listChildren(target, `/${segments.join("/")}`);
      }

      // Chat-level: file: or file:assets/notes, relative to chat assets root
      if (!appTree) {
        throw new Error("Chat file ls requires a chat tree context");
      }

      const rawPath = uri.slice("file:".length); // "" or "assets" or "assets/notes" or "notes"
      const trimmed = rawPath.trim();
      const tree = appTree.tree;
      const rootPath = ChatAppData.ASSETS_ROOT_PATH;

      const assetsRoot = tree.getVertexByPath(rootPath) as Vertex | undefined;
      if (!assetsRoot) {
        // No assets root yet → nothing to list
        return [];
      }

      if (trimmed === "" || trimmed === "." || trimmed === "/") {
        return listChildren(assetsRoot, rootPath);
      }

      // Normalize local path inside chat:
      // - If user already included the assets root (file:assets/...), keep it
      // - Otherwise, treat it as relative to the assets root (file:notes → assets/notes)
      const stripped = trimmed.replace(/^\/+/, "");
      let logicalPath: string;
      if (stripped === rootPath || stripped.startsWith(`${rootPath}/`)) {
        logicalPath = stripped;
      } else {
        logicalPath = `${rootPath}/${stripped}`;
      }

      const target = tree.getVertexByPath(logicalPath) as Vertex | undefined;
      if (!target) {
        throw new Error(`Chat path not found at ${logicalPath}`);
      }

      return listChildren(
        target,
        logicalPath
      );
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
    const path = basePath
      ? `${basePath.replace(/\/+$/, "")}/${name}`
      : name;
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

function walkByName(
  start: Vertex,
  segments: string[],
  notFoundMessage: string
): Vertex {
  let current: Vertex | undefined = start;
  for (const seg of segments) {
    const children: Vertex[] = current?.children ?? [];
    const next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);
    if (!next || !current) {
      throw new Error(notFoundMessage);
    }
    current = next;
  }
  return current!;
}


