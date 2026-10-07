import fs from "node:fs/promises";
import path from "node:path";

export async function createChannelFilePath({ threadDir, originalName, createdAt }) {
  const datePath = path.join(
    String(createdAt.getFullYear()),
    String(createdAt.getMonth() + 1).padStart(2, "0"),
    String(createdAt.getDate()).padStart(2, "0"),
  );
  const directory = path.join(threadDir, "files", datePath);
  await fs.mkdir(directory, { recursive: true });
  return buildUniqueFilePath(directory, sanitizeFileName(originalName));
}

function sanitizeFileName(input) {
  const safe = String(input || "").trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return !safe || safe === "." || safe === ".." ? `file_${Date.now()}` : safe;
}

async function buildUniqueFilePath(directory, fileName) {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || "file";
  let index = 0;
  while (true) {
    const suffix = index === 0 ? "" : `_${index}`;
    const candidatePath = path.join(directory, `${baseName}${suffix}${parsed.ext}`);
    try {
      await fs.access(candidatePath);
      index += 1;
    } catch (error) {
      if (error?.code === "ENOENT") return candidatePath;
      throw error;
    }
  }
}
