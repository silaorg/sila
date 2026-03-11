import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * @param {{
 *  threadDir: string;
 *  fileId: string;
 *  originalName: string;
 *  createdAt: Date;
 *  telegram: any;
 *  downloadFileToPath?: (url: string, destinationPath: string) => Promise<void>;
 * }} input
 */
export async function storeTelegramFile(input) {
  const datePath = buildDatePath(input.createdAt);
  const datedDir = path.join(input.threadDir, "files", datePath);
  await fs.mkdir(datedDir, { recursive: true });

  const safeName = sanitizeFileName(input.originalName);
  const targetPath = await buildUniqueFilePath(datedDir, safeName);
  const fileLink = await input.telegram.getFileLink(input.fileId);
  const downloadFile = input.downloadFileToPath ?? defaultDownloadFileToPath;
  await downloadFile(fileLink.href, targetPath);
  return targetPath;
}

function sanitizeFileName(input) {
  const normalized = String(input || "").trim();
  if (!normalized) {
    return `file_${Date.now()}`;
  }

  const safe = normalized.replace(/[/\\]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe.length || safe === "." || safe === "..") {
    return `file_${Date.now()}`;
  }
  return safe;
}

function buildDatePath(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return path.join(year, month, day);
}

async function buildUniqueFilePath(directory, fileName) {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || "file";
  const extension = parsed.ext || "";

  let index = 0;
  while (true) {
    const suffix = index === 0 ? "" : `_${index}`;
    const candidateName = `${baseName}${suffix}${extension}`;
    const candidatePath = path.join(directory, candidateName);

    try {
      await fs.access(candidatePath);
      index += 1;
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return candidatePath;
      }
      throw error;
    }
  }
}

async function defaultDownloadFileToPath(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch Telegram file. status=${response.status}`);
  }

  const writeStream = fsSync.createWriteStream(destinationPath, { flags: "wx" });
  await pipeline(Readable.fromWeb(response.body), writeStream);
}
