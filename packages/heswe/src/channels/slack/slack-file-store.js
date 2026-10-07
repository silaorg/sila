import { createChannelFilePath } from "../channel-file-store.js";
import { downloadRemoteFile } from "../../http.js";

/**
 * @param {{
 *  threadDir: string;
 *  fileUrl: string;
 *  originalName: string;
 *  createdAt: Date;
 *  botUserOAuthToken: string;
 *  downloadFileToPath?: (input: {
 *    fileUrl: string;
 *    destinationPath: string;
 *    botUserOAuthToken: string;
 *  }) => Promise<void>;
 * }} input
 */
export async function storeSlackFile(input) {
  const targetPath = await createChannelFilePath(input);
  const downloadFile = input.downloadFileToPath ?? defaultDownloadFileToPath;
  await downloadFile({
    fileUrl: input.fileUrl,
    destinationPath: targetPath,
    botUserOAuthToken: input.botUserOAuthToken,
  });
  return targetPath;
}

async function defaultDownloadFileToPath({ fileUrl, destinationPath, botUserOAuthToken }) {
  await downloadRemoteFile(fileUrl, destinationPath, {
    headers: {
      Authorization: `Bearer ${botUserOAuthToken}`,
    },
  });
}
