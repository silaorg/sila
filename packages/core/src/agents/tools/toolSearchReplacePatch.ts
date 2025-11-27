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

interface FilePatch {
  path: string;
  blocks: SearchReplaceBlock[];
}

export const searchReplacePatchInstruciton = `Use the patch tool by sending one patch string that embeds file paths and SEARCH/REPLACE blocks. For each file: put the path on its own line, then the block:

file:///assets/example.txt
<<<<<<< SEARCH
old text
=======
new text
>>>>>>> REPLACE

You can include multiple file sections in one patch; the tool applies each in order (creates missing files by default). Paths must be workspace (file:///...) or chat (file:...) URIs.

Each SEARCH block is matched once (first exact occurrence); include enough lines in SEARCH to uniquely target the intended text. An empty SEARCH replaces the entire file content for that section.

After applying a patch, read the patched file to confirm the changes.
`;

export function getToolSearchReplacePatch(
  space: Space,
  appTree?: AppTree
): LangToolWithHandler {
  return {
    name: "apply_search_replace_patch",
    description:
      "Apply SEARCH/REPLACE patches across one or more files using path-prefixed blocks.",
    parameters: {
      type: "object",
      properties: {
        patch: {
          type: "string",
          description:
            "Patch text with file path lines and SEARCH/REPLACE blocks (<<<<<<< SEARCH / ======= / >>>>>>> REPLACE).",
        },
      },
      required: ["patch"],
    },
    handler: async (args: Record<string, any>): Promise<SearchReplacePatchResult> => {
      const patch = args.patch as string | undefined;

      if (typeof patch !== "string" || !patch.trim()) {
        return {
          status: "failed",
          output: "Invalid patch: must be a non-empty string",
        };
      }

      try {
        const filePatches = parseFilePatches(patch);

        let totalChanges = 0;
        const summaries: string[] = [];

        for (const filePatch of filePatches) {
          const uri = normalizeUri(filePatch.path);
          const result = await handlePatch(space, appTree, uri, filePatch.blocks, true);
          totalChanges += result.changes;
          const details = result.info.length ? ` [${result.info.join(", ")}]` : "";
          summaries.push(
            `${filePatch.path}: ${result.changes} change${result.changes === 1 ? "" : "s"}${details}`,
          );
        }

        return {
          status: "completed",
          output: `Patched ${filePatches.length} file${filePatches.length === 1 ? "" : "s"} (${totalChanges} change${totalChanges === 1 ? "" : "s"}): ${summaries.join("; ")}`,
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

function normalizeUri(path: string): string {
  let uri = path;
  if (!uri.startsWith("file:") && !uri.startsWith("/")) {
    uri = `file:${uri}`;
  } else if (uri.startsWith("/")) {
    uri = `file://${uri}`;
  }
  return uri;
}

function applyBlocksToContent(
  content: string,
  blocks: SearchReplaceBlock[],
  pathHint?: string,
): { updated: string; info: string[] } {
  let updated = content;
  const info: string[] = [];

  for (const block of blocks) {
    const search = block.search;

    if (search === "") {
      // If SEARCH is empty, replace the whole content
      updated = block.replace;
      info.push("replaced entire file");
      continue;
    }

    const index = updated.indexOf(search);
    if (index === -1) {
      const preview = search.length > 80 ? `${search.slice(0, 77)}...` : search;
      const tip = "Ensure the SEARCH text matches exactly, including whitespace and newlines.";
      throw new Error(
        `SEARCH block not found${pathHint ? ` in ${pathHint}` : ""}: ${preview}. ${tip}`,
      );
    }

    const lineNumber = updated.slice(0, index).split("\n").length;
    updated = `${updated.slice(0, index)}${block.replace}${updated.slice(index + search.length)}`;
    info.push(`replaced at line ${lineNumber}`);
  }

  return { updated, info };
}

async function handlePatch(
  space: Space,
  appTree: AppTree | undefined,
  uri: string,
  blocks: SearchReplaceBlock[],
  createIfMissing: boolean,
): Promise<{ changes: number; info: string[] }> {
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

  const { updated, info } = applyBlocksToContent(currentContent, blocks, uri);

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

  return { changes: info.length, info };
}

function parseFilePatches(rawPatch: string): FilePatch[] {
  const cleaned = stripCodeFence(rawPatch);
  const fileBlockRegex =
    /^([^\n`][^\n]*)\n\s*(?:```[^\n]*\n)?(<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE)(?:\n```)?/gm;

  const grouped = new Map<string, SearchReplaceBlock[]>();
  let match: RegExpExecArray | null;

  while ((match = fileBlockRegex.exec(cleaned)) !== null) {
    const path = match[1].trim();
    const blockText = match[2];

    if (!path) {
      continue;
    }

    const blocks = parseSearchReplaceBlocks(blockText);
    const existing = grouped.get(path) ?? [];
    grouped.set(path, [...existing, ...blocks]);
  }

  if (grouped.size === 0) {
    throw new Error("No file paths found in patch");
  }

  return Array.from(grouped.entries()).map(([path, blocks]) => ({ path, blocks }));
}
