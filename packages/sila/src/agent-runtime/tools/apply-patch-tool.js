import fs from "node:fs";
import { applyDiff_v4a } from "aiwrapper";
import { ensureFileParent, normalizePath } from "./file-utils.js";

function isValidOperation(operation) {
  if (!operation || typeof operation !== "object") return false;
  if (typeof operation.type !== "string") return false;
  if (typeof operation.path !== "string" || !operation.path.trim()) return false;
  return ["create_file", "update_file", "delete_file"].includes(operation.type);
}

export function createToolApplyPatch(options = {}) {
  const { baseDir = process.cwd() } = options;

  return {
    name: "apply_patch",
    description: "Apply text patches using OpenAI native apply_patch operation payload.",
    parameters: {},
    handler: async (args = {}) => {
      const operation = args.operation;
      if (!isValidOperation(operation)) {
        return {
          status: "failed",
          output: "Invalid operation: expected { type, path, diff? }",
        };
      }

      const fullPath = normalizePath(operation.path, baseDir);

      try {
        if (operation.type === "delete_file") {
          try {
            await fs.promises.unlink(fullPath);
          } catch (error) {
            if (error?.code !== "ENOENT") {
              throw error;
            }
          }
          return { status: "completed", output: `Deleted ${operation.path}` };
        }

        if (typeof operation.diff !== "string") {
          return {
            status: "failed",
            output: "Invalid operation: diff must be a string for create_file/update_file",
          };
        }

        if (operation.type === "create_file") {
          await ensureFileParent(fullPath);
          const updated = applyDiff_v4a("", operation.diff, "create");
          await fs.promises.writeFile(fullPath, updated, "utf8");
          return { status: "completed", output: `Created ${operation.path}` };
        }

        if (!fs.existsSync(fullPath)) {
          return { status: "failed", output: `File not found: ${operation.path}` };
        }

        const current = await fs.promises.readFile(fullPath, "utf8");
        const updated = applyDiff_v4a(current, operation.diff);
        await fs.promises.writeFile(fullPath, updated, "utf8");
        return { status: "completed", output: `Updated ${operation.path}` };
      } catch (error) {
        return { status: "failed", output: `Error: ${error?.message ?? String(error)}` };
      }
    },
  };
}
