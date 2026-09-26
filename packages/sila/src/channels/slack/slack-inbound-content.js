import fs from "node:fs/promises";
import path from "node:path";
import { toAgentRelativePath } from "../channel-utils.js";

/**
 * Stores Slack attachments and combines them with the inbound message text.
 *
 * @param {{
 *  channelPath: string;
 *  threadId: string;
 *  normalizedText: string;
 *  files: Array<{ fileUrl: string; fileName: string; label: string }>;
 *  createdAt: Date;
 *  botUserOAuthToken: string;
 *  storeFile: (input: {
 *    threadDir: string;
 *    fileUrl: string;
 *    originalName: string;
 *    createdAt: Date;
 *    botUserOAuthToken: string;
 *  }) => Promise<string>;
 * }} input
 */
export async function buildSlackInboundContent(input) {
  if (!input.files.length) {
    return input.normalizedText;
  }

  const threadDir = path.join(input.channelPath, input.threadId);
  await fs.mkdir(threadDir, { recursive: true });
  const uploadedLines = [];

  for (const file of input.files) {
    try {
      const localPath = await input.storeFile({
        threadDir,
        fileUrl: file.fileUrl,
        originalName: file.fileName,
        createdAt: input.createdAt,
        botUserOAuthToken: input.botUserOAuthToken,
      });
      uploadedLines.push(
        `[Uploaded a ${file.label}: ${toAgentRelativePath(localPath, threadDir)}]`,
      );
    } catch (error) {
      console.error(`Failed to store Slack file ${file.fileName}:`, error);
    }
  }

  return [uploadedLines.join("\n"), input.normalizedText]
    .filter(Boolean)
    .join("\n\n");
}
