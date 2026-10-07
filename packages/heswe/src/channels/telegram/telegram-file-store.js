import { createChannelFilePath } from "../channel-file-store.js";
import { downloadRemoteFile } from "../../http.js";

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
  const targetPath = await createChannelFilePath(input);
  const fileLink = await input.telegram.getFileLink(input.fileId);
  const downloadFile = input.downloadFileToPath ?? downloadRemoteFile;
  await downloadFile(fileLink.href, targetPath);
  return targetPath;
}
