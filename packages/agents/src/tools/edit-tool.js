import fs from "node:fs";
import { ensureFileParent, normalizePath } from "./file-utils.js";

export function createToolEditDocument(options = {}) {
  const { baseDir = process.cwd() } = options;

  return {
    name: "edit_document",
    description: "Create or edit a text document.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file.",
        },
        operation: {
          type: "string",
          enum: ["write", "append", "replace"],
          description: "write=overwrite file, append=append content, replace=replace first exact match.",
        },
        content: {
          type: "string",
          description: "Content used for write/append.",
        },
        search: {
          type: "string",
          description: "Exact text to search for when operation=replace.",
        },
        replace: {
          type: "string",
          description: "Replacement text when operation=replace.",
        },
      },
      required: ["path", "operation"],
    },
    handler: async ({ path, operation, content = "", search, replace = "" }) => {
      try {
        const fullPath = normalizePath(path, baseDir);
        await ensureFileParent(fullPath);

        if (operation === "write") {
          await fs.promises.writeFile(fullPath, String(content), "utf8");
          return { status: "completed", output: `Wrote ${path}` };
        }

        if (operation === "append") {
          await fs.promises.appendFile(fullPath, String(content), "utf8");
          return { status: "completed", output: `Appended to ${path}` };
        }

        if (operation === "replace") {
          if (typeof search !== "string" || search.length === 0) {
            return { status: "failed", output: "operation=replace requires non-empty search text." };
          }

          const existing = fs.existsSync(fullPath) ? await fs.promises.readFile(fullPath, "utf8") : "";
          const index = existing.indexOf(search);
          if (index === -1) {
            return { status: "failed", output: `Search text not found in ${path}` };
          }

          const updated = `${existing.slice(0, index)}${replace}${existing.slice(index + search.length)}`;
          await fs.promises.writeFile(fullPath, updated, "utf8");
          return { status: "completed", output: `Replaced text in ${path}` };
        }

        return { status: "failed", output: `Unsupported operation: ${operation}` };
      } catch (error) {
        return { status: "failed", output: `Error editing file: ${error.message}` };
      }
    },
  };
}
