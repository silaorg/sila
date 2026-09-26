import fs from "node:fs";
import { ensureFileParent, normalizePath } from "./file-utils.js";
import { parseFilePatches } from "./patch-utils.js";

function applyBlocksToContent(content, blocks, pathHint) {
  let updated = content;
  const info = [];

  for (const block of blocks) {
    if (block.search === "") {
      updated = block.replace;
      info.push("replaced entire file");
      continue;
    }

    const index = updated.indexOf(block.search);
    if (index === -1) {
      const preview = block.search.length > 80 ? `${block.search.slice(0, 77)}...` : block.search;
      throw new Error(`SEARCH block not found in ${pathHint}: ${preview}`);
    }

    const lineNumber = updated.slice(0, index).split("\n").length;
    updated = `${updated.slice(0, index)}${block.replace}${updated.slice(index + block.search.length)}`;
    info.push(`replaced at line ${lineNumber}`);
  }

  return { updated, info };
}

export function createToolSearchReplacePatch(options = {}) {
  const { baseDir = process.cwd() } = options;

  return {
    name: "apply_search_replace_patch",
    description: "Apply SEARCH/REPLACE patch blocks across one or more files.",
    parameters: {
      type: "object",
      properties: {
        patch: {
          type: "string",
          description:
            "Patch string with file path lines and SEARCH/REPLACE blocks (<<<<<<< SEARCH / ======= / >>>>>>> REPLACE).",
        },
      },
      required: ["patch"],
    },
    handler: async ({ patch }) => {
      if (typeof patch !== "string" || !patch.trim()) {
        return { status: "failed", output: "Invalid patch: must be a non-empty string." };
      }

      try {
        const filePatches = parseFilePatches(patch);
        let totalChanges = 0;
        const summaries = [];

        for (const filePatch of filePatches) {
          const filePath = normalizePath(filePatch.path, baseDir);
          await ensureFileParent(filePath);

          let content = "";
          if (fs.existsSync(filePath)) {
            content = await fs.promises.readFile(filePath, "utf8");
          }

          const { updated, info } = applyBlocksToContent(content, filePatch.blocks, filePatch.path);
          await fs.promises.writeFile(filePath, updated, "utf8");

          totalChanges += info.length;
          summaries.push(
            `${filePatch.path}: ${info.length} change${info.length === 1 ? "" : "s"}${info.length ? ` [${info.join(", ")}]` : ""}`,
          );
        }

        return {
          status: "completed",
          output: `Patched ${filePatches.length} file${filePatches.length === 1 ? "" : "s"} (${totalChanges} change${totalChanges === 1 ? "" : "s"}): ${summaries.join("; ")}`,
        };
      } catch (error) {
        return { status: "failed", output: `Error: ${error?.message ?? String(error)}` };
      }
    },
  };
}
