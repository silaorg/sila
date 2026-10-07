import fs from "node:fs/promises";

export async function readDirectoryEntriesOrEmpty(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}
