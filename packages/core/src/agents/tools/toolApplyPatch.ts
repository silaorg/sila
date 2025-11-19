import type { LangToolWithHandler } from "aiwrapper";
import { applyDiff_v4a } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { ensureFileParent, resolvePath, inferTextMimeFromPath, validateTextMimeType } from "./fileUtils";

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

      // Normalize URI
      let uri = op.path;
      if (!uri.startsWith("file:") && !uri.startsWith("/")) {
        uri = `file:${uri}`;
      } else if (uri.startsWith("/")) {
        uri = `file://${uri}`;
      }

      try {
        if (op.type === "create_file") {
          await handleCreate(space, appTree, uri, op.diff);
          return {
            status: "completed",
            output: `Created ${op.path}`,
          };
        }

        if (op.type === "update_file") {
          await handleUpdate(space, appTree, uri, op.diff);
          return {
            status: "completed",
            output: `Updated ${op.path}`,
          };
        }

        if (op.type === "delete_file") {
          await handleDelete(space, appTree, uri);
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

async function handleCreate(
  space: Space,
  appTree: AppTree | undefined,
  uri: string,
  diff: string | undefined
): Promise<void> {
  if (!diff && diff !== "") {
    throw new Error("apply_patch: missing diff for create operation");
  }

  const store = space.getFileStore();
  if (!store) {
    throw new Error("apply_patch: FileStore is not configured for this space");
  }

  // Ensure parent exists
  const { parent, name } = ensureFileParent(space, appTree, uri);
  
  // Check if file exists
  const existingVertex = parent.children?.find(c => c.name === name);
  
  // Load existing content if any (treating create as upsert/overwrite if exists, 
  // though strict create might should fail? apply_patch usually implies flexibility)
  // But if it's "create_file", typically we start empty.
  // Let's assume empty for create_file unless we want to support overwrite.
  // The original implementation treated create/update identically except for the mode passed to applyDiff.

  let currentContent = "";
  let mimeType: string | undefined;
  let mutableId: string | undefined;

  if (existingVertex) {
    const existingId = (existingVertex.getProperty("id") as string | undefined)?.trim();
    const existingHash = (existingVertex.getProperty("hash") as string | undefined)?.trim();

    if (existingId) {
      const bytes = await store.getMutable(existingId);
      currentContent = new TextDecoder("utf-8").decode(bytes);
      mutableId = existingId;
    } else if (existingHash) {
      const bytes = await store.getBytes(existingHash);
      currentContent = new TextDecoder("utf-8").decode(bytes);
    }
    mimeType = existingVertex.getProperty("mimeType") as string | undefined;
  }

  const updated = (applyDiff_v4a as any)(currentContent, diff!, "create");

  const bytes = new TextEncoder().encode(updated);
  const inferredMime = mimeType || inferTextMimeFromPath(name) || "text/plain";

  validateTextMimeType(inferredMime);

  if (!mutableId) {
    mutableId = crypto.randomUUID();
  }

  await store.putMutable(mutableId, bytes);

  if (existingVertex) {
    const existingHash = (existingVertex.getProperty("hash") as string | undefined)?.trim();
    if (existingHash) {
      existingVertex.setProperty("originalHash", existingHash);
    }
    existingVertex.setProperty("id", mutableId);
    existingVertex.setProperty("mimeType", inferredMime);
    existingVertex.setProperty("size", bytes.byteLength);
  } else {
    parent.newNamedChild(name, {
      name: name,
      id: mutableId,
      mimeType: inferredMime,
      size: bytes.byteLength,
    });
  }
}

async function handleUpdate(
  space: Space,
  appTree: AppTree | undefined,
  uri: string,
  diff: string | undefined
): Promise<void> {
  if (!diff && diff !== "") {
    throw new Error("apply_patch: missing diff for update operation");
  }

  const store = space.getFileStore();
  if (!store) {
    throw new Error("apply_patch: FileStore is not configured for this space");
  }

  const resolved = resolvePath(space, appTree, uri);
  
  if (!resolved.vertex) {
    throw new Error(`apply_patch: file not found at ${uri}`);
  }
  
  const fileVertex = resolved.vertex;

  let currentContent = "";
  let mutableId: string | undefined;

  const existingId = (fileVertex.getProperty("id") as string | undefined)?.trim();
  const existingHash = (fileVertex.getProperty("hash") as string | undefined)?.trim();

  if (existingId) {
    const bytes = await store.getMutable(existingId);
    currentContent = new TextDecoder("utf-8").decode(bytes);
    mutableId = existingId;
  } else if (existingHash) {
    const bytes = await store.getBytes(existingHash);
    currentContent = new TextDecoder("utf-8").decode(bytes);
  }

  const mimeType = fileVertex.getProperty("mimeType") as string | undefined;
  const inferredMime = mimeType || inferTextMimeFromPath(fileVertex.name || "") || "text/plain";
  
  validateTextMimeType(inferredMime);

  const updated = (applyDiff_v4a as any)(currentContent, diff!, undefined); // undefined mode = update

  const bytes = new TextEncoder().encode(updated);

  if (!mutableId) {
    mutableId = crypto.randomUUID();
  }

  await store.putMutable(mutableId, bytes);

  const originalHash = (fileVertex.getProperty("hash") as string | undefined)?.trim();
  if (originalHash) {
    fileVertex.setProperty("originalHash", originalHash);
  }
  fileVertex.setProperty("id", mutableId);
  fileVertex.setProperty("mimeType", inferredMime);
  fileVertex.setProperty("size", bytes.byteLength);
}

async function handleDelete(
  space: Space,
  appTree: AppTree | undefined,
  uri: string
): Promise<void> {
  const resolved = resolvePath(space, appTree, uri);
  
  if (!resolved.vertex) {
    // Nothing to delete
    return;
  }
  
  const target = resolved.vertex;

  // Prevent deleting the workspace root or chat files root
  if (target.id === resolved.scopeRoot.id) {
    throw new Error("apply_patch: cannot delete root");
  }

  resolved.tree.deleteVertex(target.id);
}
