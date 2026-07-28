import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Replaces a JSON file atomically so a crash cannot leave a half-written file.
 *
 * @param {string} filePath
 * @param {unknown} value
 */
export async function writeJsonFile(filePath, value) {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const payload = `${JSON.stringify(value, null, 2)}\n`;

  try {
    await fs.writeFile(temporaryPath, payload, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}
