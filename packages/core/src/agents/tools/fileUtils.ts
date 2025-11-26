import { Space } from "../../spaces/Space";
import { AppTree } from "../../spaces/AppTree";
import { Vertex } from "reptree";
import {
  ensureChatAssetsRoot,
  ensureFolder,
  getRootForPath,
  parseFileUri,
} from "../../spaces/files/filePathUtils";

export { ensureChatAssetsRoot };

export function inferTextMimeFromPath(path: string): string | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
  if (lower.endsWith(".ts")) return "application/x-typescript";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".svelte")) return "text/html"; // Treat as text
  
  // Detect common binary formats to reject them
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  
  return undefined;
}

export function validateTextMimeType(mimeType: string): void {
  if (!mimeType.startsWith("text/") && mimeType !== "application/json" && mimeType !== "application/javascript" && mimeType !== "application/x-typescript") {
    throw new Error(
      `Operation only supported for text files (got mimeType='${mimeType}')`
    );
  }
}

export function ensureFileParent(
  space: Space,
  appTree: AppTree | undefined,
  uri: string
): { parent: Vertex; name: string } {
  const { isWorkspacePath, segments } = parseFileUri(uri);
  const root = getRootForPath(space, appTree, isWorkspacePath);

  if (segments.length === 0) {
    throw new Error("Path is empty or is root");
  }

  const name = segments[segments.length - 1];
  const parentSegments = segments.slice(0, -1);
  const parent = ensureFolder(root, parentSegments);

  return { parent, name };
}

export function ensurePath(
  space: Space,
  appTree: AppTree | undefined,
  uri: string
): Vertex {
  const { isWorkspacePath, segments } = parseFileUri(uri);
  const root = getRootForPath(space, appTree, isWorkspacePath);

  if (segments.length === 0) {
    throw new Error("Path is empty or is root");
  }

  return ensureFolder(root, segments);
}
