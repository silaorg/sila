import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "./file-utils.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"]);

/**
 * @param {string} root
 * @param {string} target
 * @returns {boolean}
 */
function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * @param {string} filePath
 * @returns {"photo" | "video" | "audio" | "document"}
 */
function inferKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "photo";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  return "document";
}

export function createToolSendTelegramFile(sendFile, options = {}) {
  const baseDir = options.baseDir ?? process.cwd();
  const allowedRoot = path.resolve(baseDir, "assets");

  return {
    name: "send_telegram_file",
    description: "Send a local file to Telegram chat. Use paths only from ./assets.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to a local file in ./assets.",
        },
        kind: {
          type: "string",
          enum: ["auto", "photo", "video", "audio", "voice", "document"],
          description: "How to send the file. Use 'auto' to infer from extension.",
          default: "auto",
        },
        caption: {
          type: "string",
          description: "Optional caption for the file.",
        },
      },
      required: ["path"],
    },
    handler: async ({ path: filePath, kind = "auto", caption }) => {
      try {
        if (typeof sendFile !== "function") {
          return { error: "Telegram sender is not configured." };
        }

        if (!filePath || typeof filePath !== "string") {
          return { error: "path is required and must be a string." };
        }

        const fullPath = normalizePath(filePath, baseDir);
        if (!isWithin(allowedRoot, fullPath)) {
          return { error: "Only files from ./assets can be sent." };
        }

        if (!fs.existsSync(fullPath)) {
          return { error: `File not found: ${filePath}` };
        }

        const stats = await fs.promises.stat(fullPath);
        if (!stats.isFile()) {
          return { error: `Path is not a file: ${filePath}` };
        }

        const resolvedKind = kind === "auto" ? inferKind(fullPath) : kind;
        const safeCaption = typeof caption === "string" && caption.trim() ? caption.trim() : undefined;

        const result = await sendFile({
          path: fullPath,
          kind: resolvedKind,
          caption: safeCaption,
        });

        return {
          status: "sent",
          kind: resolvedKind,
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
