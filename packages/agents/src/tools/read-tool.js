import fs from "node:fs";
import { normalizePath } from "./file-utils.js";

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toLineSlice(text, start, limit) {
  const lines = String(text).split("\n");
  const safeStart = Math.max(0, Number(start) || 0);
  const safeLimit = Math.max(1, Number(limit) || 100);
  const slicedLines = lines.slice(safeStart, safeStart + safeLimit);
  return {
    totalLines: lines.length,
    content: slicedLines.join("\n"),
  };
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createToolReadDocument(options = {}) {
  const { baseDir = process.cwd() } = options;

  return {
    name: "read_document",
    description: "Read text content from a local document or URL.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Local file path or URL.",
        },
        start: {
          type: "integer",
          description: "Start line (0-based).",
          default: 0,
        },
        limit: {
          type: "integer",
          description: "Number of lines to return.",
          default: 200,
        },
      },
      required: ["path"],
    },
    handler: async ({ path, start = 0, limit = 200 }) => {
      try {
        if (isHttpUrl(path)) {
          const response = await fetch(path);
          if (!response.ok) {
            return { error: `Failed to fetch URL: ${response.status} ${response.statusText}` };
          }

          const raw = await response.text();
          const contentType = String(response.headers.get("content-type") || "");
          const text = contentType.includes("text/html") ? stripHtml(raw) : raw;
          const sliced = toLineSlice(text, start, limit);

          return {
            type: "url",
            contentType,
            ...sliced,
          };
        }

        const fullPath = normalizePath(path, baseDir);
        if (!fs.existsSync(fullPath)) {
          return { error: `File not found: ${path}` };
        }

        const text = await fs.promises.readFile(fullPath, "utf8");
        const sliced = toLineSlice(text, start, limit);
        return {
          type: "text",
          path: fullPath,
          ...sliced,
        };
      } catch (error) {
        return { error: `Error reading document: ${error.message}` };
      }
    },
  };
}
