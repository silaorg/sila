import fs from "node:fs";
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
          description: "Path to a local file.",
        },
        title: {
          type: "string",
          description: "Optional file title shown in Slack.",
        },
        comment: {
          type: "string",
          description: "Optional message to include with the file upload.",
        },
      },
      required: ["path"],
    },
    handler: async ({ path: filePath, title, comment }) => {
      try {
        if (typeof sendFile !== "function") {
          return { error: "Slack sender is not configured." };
        }

        if (!filePath || typeof filePath !== "string") {
          return { error: "path is required and must be a string." };
        }

        const fullPath = normalizePath(filePath, baseDir);

        if (!fs.existsSync(fullPath)) {
          return { error: `File not found: ${filePath}` };
        }

        const stats = await fs.promises.stat(fullPath);
        if (!stats.isFile()) {
          return { error: `Path is not a file: ${filePath}` };
        }

        const safeTitle = typeof title === "string" && title.trim() ? title.trim() : undefined;
        const safeComment = typeof comment === "string" && comment.trim() ? comment.trim() : undefined;

        const result = await sendFile({
          path: fullPath,
          title: safeTitle,
          comment: safeComment,
        });

        return {
          status: "sent",
          file: filePath,
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
