import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { ensureFileParent, inferTextMimeFromPath, validateTextMimeType } from "./fileUtils";

interface SearchReplacePatchResult {
  status: "completed" | "failed";
  output: string;
}

interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export function getToolSearchReplacePatch(
  space: Space,
  appTree?: AppTree
): LangToolWithHandler {
  return {
    name: "apply_search_replace_patch",
    description:
      "Apply Aider-style SEARCH/REPLACE patches to a file. Works with any model.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The file path to patch. Accepts workspace paths like 'file:///assets/file.txt' or chat paths like 'file:note.txt'.",
        },
        patch: {
          type: "string",
          description:
            "Patch text using SEARCH/REPLACE blocks (<<<<<<< SEARCH / ======= / >>>>>>> REPLACE).",
        },
        create_if_missing: {
          type: "boolean",
          description:
            "Create the file if it does not exist (default: true, creates empty file before applying patch).",
        },
      },
      required: ["path", "patch"],
    },
    handler: async (args: Record<string, any>): Promise<SearchReplacePatchResult> => {
      const path = args.path as string | undefined;
      const patch = args.patch as string | undefined;
      const createIfMissing = args.create_if_missing !== false;

      if (!path || typeof path !== "string") {
        return {
          status: "failed",
          output: "Invalid path: must be a non-empty string",
        };
      }

      if (typeof patch !== "string" || !patch.trim()) {
        return {
          status: "failed",
          output: "Invalid patch: must be a non-empty string",
        };
      }

      let uri = path;
      if (!uri.startsWith("file:") && !uri.startsWith("/")) {
        uri = `file:${uri}`;
      } else if (uri.startsWith("/")) {
        uri = `file://${uri}`;
      }

      try {
        const changes = await handlePatch(space, appTree, uri, patch, createIfMissing);
        return {
          status: "completed",
          output: `Patched ${path} (${changes} change${changes === 1 ? "" : "s"})`,
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

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```") || trimmed === "```") {
    return trimmed;
  }

  const withoutFirstLine = trimmed.replace(/^```[^\n]*\n/, "");
  const closingIndex = withoutFirstLine.lastIndexOf("\n```");
  if (closingIndex !== -1) {
    return withoutFirstLine.slice(0, closingIndex).trim();
  }
  return withoutFirstLine.trim();
}

function parseSearchReplaceBlocks(patch: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  const regex = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n?=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(patch)) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }

  if (blocks.length === 0) {
    throw new Error("No SEARCH/REPLACE blocks found in patch");
  }

  return blocks;
}

function applyBlocksToContent(content: string, blocks: SearchReplaceBlock[]): string {
  let updated = content;

  for (const block of blocks) {
    const search = block.search;

    if (search === "") {
      // If SEARCH is empty, replace the whole content
      updated = block.replace;
      continue;
    }

    const index = updated.indexOf(search);
    if (index === -1) {
      const preview = search.length > 80 ? `${search.slice(0, 77)}...` : search;
      throw new Error(`SEARCH block not found: ${preview}`);
    }

    updated = `${updated.slice(0, index)}${block.replace}${updated.slice(index + search.length)}`;
  }

  return updated;
}

async function handlePatch(
  space: Space,
  appTree: AppTree | undefined,
  uri: string,
  rawPatch: string,
  createIfMissing: boolean,
): Promise<number> {
  const store = space.fileStore;
  if (!store) {
    throw new Error("apply_search_replace_patch: FileStore is not configured for this space");
  }

  const { parent, name } = ensureFileParent(space, appTree, uri);
  const existingVertex = parent.children?.find((c) => c.name === name);

  if (!existingVertex && !createIfMissing) {
    throw new Error(`apply_search_replace_patch: file not found at ${uri}`);
  }

  let currentContent = "";
  let mimeType: string | undefined = existingVertex?.getProperty("mimeType") as string | undefined;
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
  }

  const patch = stripCodeFence(rawPatch);
  const blocks = parseSearchReplaceBlocks(patch);
  const updated = applyBlocksToContent(currentContent, blocks);

  const inferredMime = mimeType || inferTextMimeFromPath(name) || "text/plain";
  validateTextMimeType(inferredMime);

  if (!mutableId) {
    mutableId = crypto.randomUUID();
  }

  const bytes = new TextEncoder().encode(updated);
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
      name,
      id: mutableId,
      mimeType: inferredMime,
      size: bytes.byteLength,
    });
  }

  return blocks.length;
}
