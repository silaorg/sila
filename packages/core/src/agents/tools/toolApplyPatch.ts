import type { LangToolWithHandler } from "aiwrapper";
import { applyDiff_v4a } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import type { Vertex } from "reptree";

type ApplyPatchOperation =
  | { type: "create_file"; path: string; diff: string }
  | { type: "update_file"; path: string; diff: string }
  | { type: "delete_file"; path: string };

interface ApplyPatchResult {
  status: "completed" | "failed";
  output: string;
}

export function getToolApplyPatch(
  space: Space,
  appTree?: AppTree
): LangToolWithHandler {
  return {
    // OpenAI's apply_patch is a built-in tool. Name must be "apply_patch";
    // parameters are defined by the model. We expose an empty schema here
    // to satisfy typing, but the model will send its own structure.
    name: "apply_patch",
    description: "Apply text patches to files in this workspace using OpenAI's apply_patch tool.",
    parameters: {},
    handler: async (args: Record<string, any>): Promise<ApplyPatchResult> => {
      const op = args.operation as ApplyPatchOperation | undefined;
      if (!op || typeof op !== "object" || !("type" in op) || !("path" in op)) {
        return {
          status: "failed",
          output: "Invalid operation: missing type or path",
        };
      }

      try {
        if (op.type === "create_file") {
          await handleCreateOrUpdate(space, appTree, op.path, op.diff, true);
          return {
            status: "completed",
            output: `Created ${op.path}`,
          };
        }

        if (op.type === "update_file") {
          await handleCreateOrUpdate(space, appTree, op.path, op.diff, false);
          return {
            status: "completed",
            output: `Updated ${op.path}`,
          };
        }

        if (op.type === "delete_file") {
          await handleDelete(space, appTree, op.path);
          return {
            status: "completed",
            output: `Deleted ${op.path}`,
          };
        }

        return {
          status: "failed",
          output: `Unknown operation type: ${(op as any).type}`,
        };
      } catch (error: any) {
        return {
          status: "failed",
          output: `Error: ${error?.message ?? String(error)}`,
        };
      }
    },
  };
}

async function handleCreateOrUpdate(
  space: Space,
  appTree: AppTree | undefined,
  path: string,
  diff: string | undefined,
  isCreate: boolean
): Promise<void> {
  if (!diff && diff !== "") {
    throw new Error("apply_patch: missing diff for create/update operation");
  }

  const store = space.getFileStore();
  if (!store) {
    throw new Error("apply_patch: FileStore is not configured for this space");
  }

  const target = await resolveTarget(space, appTree, path);

  // Create or load existing content
  let currentContent = "";
  let mimeType: string | undefined;
  let mutableId: string | undefined;

  if (target.fileVertex) {
    const existingId = (target.fileVertex.getProperty("id") as string | undefined)?.trim();
    const existingHash = (target.fileVertex.getProperty("hash") as string | undefined)?.trim();

    if (existingId) {
      // Mutable file: load from uuid-based storage
      const bytes = await store.getMutable(existingId);
      currentContent = new TextDecoder("utf-8").decode(bytes);
      mutableId = existingId;
    } else if (existingHash) {
      // Static file: load from CAS, then treat as base for mutable editing
      const bytes = await store.getBytes(existingHash);
      currentContent = new TextDecoder("utf-8").decode(bytes);
      // We'll create a new mutable id when writing back
    }

    mimeType = target.fileVertex.getProperty("mimeType") as string | undefined;
  }

  const mode: "create" | undefined = isCreate ? "create" : undefined;
  const updated = (applyDiff_v4a as any)(currentContent, diff!, mode);

  const bytes = new TextEncoder().encode(updated);
  const inferredMime =
    mimeType || inferTextMimeFromPath(target.fileName) || "text/plain";

  // Only allow text-like files
  if (!inferredMime.startsWith("text/") && inferredMime !== "application/json") {
    throw new Error(
      `apply_patch: only text files can be edited (got mimeType='${inferredMime}')`
    );
  }

  if (!mutableId) {
    // No existing mutable id: create one
    mutableId = crypto.randomUUID();
  }

  // Write updated content into mutable storage
  await store.putMutable(mutableId, bytes);

  if (target.fileVertex) {
    // Update existing file vertex to point to mutable id
    const existingHash = (target.fileVertex.getProperty("hash") as string | undefined)?.trim();
    if (existingHash) {
      // Preserve original immutable hash separately for reference if needed
      target.fileVertex.setProperty("originalHash", existingHash);
    }
    target.fileVertex.setProperty("id", mutableId);
    target.fileVertex.setProperty("mimeType", inferredMime);
    target.fileVertex.setProperty("size", bytes.byteLength);
  } else {
    // Create new file vertex pointing to mutable id
    const folder = target.folder;
    folder.newNamedChild(target.fileName, {
      name: target.fileName,
      id: mutableId,
      mimeType: inferredMime,
      size: bytes.byteLength,
    });
  }
}

async function handleDelete(
  space: Space,
  appTree: AppTree | undefined,
  path: string
): Promise<void> {
  const target = await resolveTarget(space, appTree, path, { allowMissingFile: true });
  if (!target.fileVertex) {
    // Nothing to delete
    return;
  }

  // Prevent deleting the workspace root or chat files root
  const root = space.rootVertex;
  if (target.fileVertex.id === root.id) {
    throw new Error("apply_patch: cannot delete workspace root");
  }

  if (target.scope === "chat" && target.fileVertex.id === target.folder.id) {
    throw new Error("apply_patch: cannot delete chat files root");
  }

  target.fileVertex.tree.deleteVertex(target.fileVertex.id);
}

type TargetScope = "workspace" | "chat";

interface ResolvedTarget {
  scope: TargetScope;
  folder: Vertex;
  fileVertex?: Vertex;
  fileName: string;
}

async function resolveTarget(
  space: Space,
  appTree: AppTree | undefined,
  path: string,
  opts?: { allowMissingFile?: boolean }
): Promise<ResolvedTarget> {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error("apply_patch: path is empty");
  }

  // Normalize to a workspace/chat path model
  if (trimmed.startsWith("file:///")) {
    // Workspace-level path from space root, e.g. file:///assets/brand.md
    const rel = trimmed.slice("file:///".length); // "assets/brand.md"
    return resolveWorkspacePath(space, rel, opts);
  }

  if (trimmed.startsWith("file:")) {
    // Chat-level path relative to chat 'files' root, e.g. file:document.md
    const rel = trimmed.slice("file:".length); // "document.md" or "notes/doc.md"
    return resolveChatPath(space, appTree, rel, opts);
  }

  // Fallbacks: absolute workspace path (/assets/brand.md) or relative chat path (test.md)
  if (trimmed.startsWith("/")) {
    const rel = trimmed.slice(1); // "assets/brand.md"
    return resolveWorkspacePath(space, rel, opts);
  }

  // Default: relative chat path
  return resolveChatPath(space, appTree, trimmed, opts);
}

function resolveWorkspacePath(
  space: Space,
  relPath: string,
  opts?: { allowMissingFile?: boolean }
): ResolvedTarget {
  // Normalize path: drop '.' segments
  const segments = relPath
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== ".");
  if (segments.length === 0) {
    throw new Error("apply_patch: workspace path is empty");
  }

  const fileName = segments[segments.length - 1];
  const folderSegments = segments.slice(0, -1);

  let folder: Vertex = space.rootVertex;
  for (const seg of folderSegments) {
    const children: Vertex[] = folder.children ?? [];
    let next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);
    if (!next) {
      // Create intermediate folders on demand
      next = folder.newNamedChild(seg, {
        createdAt: Date.now(),
      }) as Vertex;
    } else {
      const mimeType = next.getProperty("mimeType") as string | undefined;
      if (mimeType) {
        throw new Error(
          `apply_patch: workspace path segment '${seg}' is a file, not a folder`
        );
      }
    }
    folder = next;
  }

  const children: Vertex[] = folder.children ?? [];
  const fileVertex = children.find((c: Vertex) => c.name === fileName);

  if (!fileVertex && !opts?.allowMissingFile && children.length > 0) {
    // It's fine if the file doesn't exist for create_file; caller controls allowMissingFile.
  }

  return {
    scope: "workspace",
    folder,
    fileVertex,
    fileName,
  };
}

function resolveChatPath(
  space: Space,
  appTree: AppTree | undefined,
  relPath: string,
  opts?: { allowMissingFile?: boolean }
): ResolvedTarget {
  if (!appTree) {
    throw new Error("apply_patch: chat path requires a chat tree context");
  }

  // Normalize path: drop '.' segments
  const segments = relPath
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== ".");
  if (segments.length === 0) {
    throw new Error("apply_patch: chat path is empty");
  }

  let segs = segments;
  if (segs[0] === "files") {
    segs = segs.slice(1);
  }
  if (segs.length === 0) {
    throw new Error("apply_patch: chat path does not contain a file name");
  }

  const fileName = segs[segs.length - 1];
  const folderSegments = segs.slice(0, -1);

  let filesRoot = appTree.tree.getVertexByPath("files") as Vertex | undefined;
  if (!filesRoot) {
    filesRoot = appTree.tree.root!.newNamedChild("files") as Vertex;
    filesRoot.setProperty("createdAt", Date.now());
  }

  let folder: Vertex = filesRoot;
  for (const seg of folderSegments) {
    const children: Vertex[] = folder.children ?? [];
    let next: Vertex | undefined = children.find((c: Vertex) => c.name === seg);
    if (!next) {
      next = folder.newNamedChild(seg, {
        createdAt: Date.now(),
      }) as Vertex;
    } else {
      const mimeType = next.getProperty("mimeType") as string | undefined;
      if (mimeType) {
        throw new Error(
          `apply_patch: chat path segment '${seg}' is a file, not a folder`
        );
      }
    }
    folder = next;
  }

  const children: Vertex[] = folder.children ?? [];
  const fileVertex = children.find((c: Vertex) => c.name === fileName);

  if (!fileVertex && !opts?.allowMissingFile && children.length > 0) {
    // It's fine if the file doesn't exist for create_file; caller controls allowMissingFile.
  }

  return {
    scope: "chat",
    folder,
    fileVertex,
    fileName,
  };
}

function inferTextMimeFromPath(path: string): string | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
  if (lower.endsWith(".ts")) return "application/x-typescript";
  return undefined;
}


