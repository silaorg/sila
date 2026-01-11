import type { LangToolWithHandler } from "aiwrapper";
import type { AppTree } from "../../spaces/AppTree";
import type { Space } from "../../spaces/Space";
import { ensureFileParent, inferTextMimeFromPath, validateTextMimeType } from "./fileUtils";
import type { AgentTool } from "./AgentTool";

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

export const searchReplacePatchInstruction = `Use the patch tool by sending one patch string that embeds file paths and SEARCH/REPLACE blocks. For each file: put the path on its own line, then:

file:///assets/example.txt
<<<<<<< SEARCH
old text
=======
new text
>>>>>>> REPLACE

Patch matching rules:
- SEARCH is an exact match and is applied once (first occurrence).
- Use the smallest SEARCH block that is guaranteed unique.
- Start with 1-3 lines (target line + minimal nearby context). If ambiguous or likely repeated, expand by adding the nearest unique anchor (e.g., a heading) and keep it as short as possible (prefer <10 lines).

An empty SEARCH replaces the entire file content. Subsequent blocks for the same file apply to the updated content.

You can include multiple file sections in one patch; all blocks for the same path are grouped and applied in the order they appear, and files are processed by first appearance of each path. Missing files are created by default.`;

export const toolSearchReplacePatch: AgentTool = {
  name: "apply_search_replace_patch",
  description:
    "Apply SEARCH/REPLACE patches across one or more files using path-prefixed blocks.",
  instructions: searchReplacePatchInstruction,
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
  getTool(services, appTree): LangToolWithHandler {
    const space = services.space;
    return {
      name: this.name,
      description: this.description!,
      parameters: this.parameters!,
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
  },
};

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
    existingVertex.setProperty("updatedAt", Date.now());
  } else {
    parent.newNamedChild(name, {
      name,
      id: mutableId,
      mimeType: inferredMime,
      size: bytes.byteLength,
      updatedAt: Date.now(),
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
