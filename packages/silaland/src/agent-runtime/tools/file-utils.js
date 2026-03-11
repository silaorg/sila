import fs from "node:fs";
import path from "node:path";

export async function ensureFileParent(filePath) {
  const dir = path.dirname(filePath);
  try {
    await fs.promises.access(dir);
  } catch {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

export function normalizePath(uri, baseDir = process.cwd()) {
  let cleanPath = String(uri || "");
  if (cleanPath.startsWith("file://")) {
    cleanPath = cleanPath.slice(7);
  } else if (cleanPath.startsWith("file:")) {
    cleanPath = cleanPath.slice(5);
  }
  return path.resolve(baseDir, cleanPath);
}
