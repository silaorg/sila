import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "./file-utils.js";

export function createToolSendSlackFile(sendFile, options = {}) {
  const baseDir = options.baseDir ?? process.cwd();

  return {
    name: "send_slack_file",
    description: "Upload a local file to Slack chat.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to a local file. Use either path or paths.",
        },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "List of local file paths to upload in one Slack message. Use either path or paths.",
        },
        title: {
          type: "string",
          description: "Optional file title shown in Slack for single-file upload.",
        },
        comment: {
          type: "string",
          description: "Optional message to include with the file upload.",
        },
      },
      required: [],
    },
    handler: async ({ path: singlePath, paths, title, comment }) => {
      try {
        if (typeof sendFile !== "function") {
          return { error: "Slack sender is not configured." };
        }

        const hasSinglePath = typeof singlePath === "string" && singlePath.trim().length > 0;
        const hasManyPaths = Array.isArray(paths) && paths.length > 0;
        if (!hasSinglePath && !hasManyPaths) {
          return { error: "Provide path (string) or paths (non-empty array of strings)." };
        }
        if (hasSinglePath && hasManyPaths) {
          return { error: "Use either path or paths, not both." };
        }

        const inputPaths = hasSinglePath ? [singlePath] : paths;
        if (!inputPaths.every((filePath) => typeof filePath === "string" && filePath.trim().length > 0)) {
          return { error: "All paths must be non-empty strings." };
        }

        const resolvedPaths = [];
        for (const originalPath of inputPaths) {
          const fullPath = normalizePath(originalPath, baseDir);

          if (!fs.existsSync(fullPath)) {
            return { error: `File not found: ${originalPath}` };
          }

          const stats = await fs.promises.stat(fullPath);
          if (!stats.isFile()) {
            return { error: `Path is not a file: ${originalPath}` };
          }
          resolvedPaths.push(fullPath);
        }

        const safeTitle = typeof title === "string" && title.trim() ? title.trim() : undefined;
        const safeComment = typeof comment === "string" && comment.trim() ? comment.trim() : undefined;
        if (resolvedPaths.length > 1 && safeTitle) {
          return { error: "title is only supported for single-file upload. Use comment for multi-file uploads." };
        }

        let result;
        if (resolvedPaths.length === 1) {
          result = await sendFile({
            path: resolvedPaths[0],
            title: safeTitle,
            comment: safeComment,
          });
        } else {
          result = await sendFile({
            files: resolvedPaths.map((resolvedPath) => ({
              path: resolvedPath,
              filename: path.basename(resolvedPath),
            })),
            comment: safeComment,
          });
        }

        return {
          status: "sent",
          file: hasSinglePath ? singlePath : undefined,
          files: hasManyPaths ? paths : undefined,
          result,
        };
      } catch (error) {
        return {
          error: `Failed to send file: ${error.message}`,
        };
      }
    },
  };
}
