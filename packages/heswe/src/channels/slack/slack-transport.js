import path from "node:path";
import {
  getMessageFiles,
  getSlackFileId,
  normalizeInboundFile,
} from "./slack-input-parser.js";

export class SlackTransport {
  constructor(app) {
    this.app = app;
  }

  sendMessage(channel, text, threadTs) {
    return this.app.client.chat.postMessage({
      channel,
      text,
      mrkdwn: true,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    });
  }

  updateMessage(channel, ts, text) {
    return this.app.client.chat.update({
      channel,
      ts,
      text,
      mrkdwn: true,
    });
  }

  async sendFile(thread, payload) {
    const { path: filePath, files, title, comment } = payload;
    const hasManyFiles = Array.isArray(files) && files.length > 0;
    let upload;

    if (hasManyFiles) {
      upload = await this.app.client.files.uploadV2({
        channel_id: thread.channelId,
        file_uploads: files.map((fileEntry) => ({
          file: fileEntry.path,
          filename: fileEntry.filename || path.basename(fileEntry.path),
          ...(fileEntry.title ? { title: fileEntry.title } : {}),
        })),
        ...(thread.threadTs ? { thread_ts: thread.threadTs } : {}),
        ...(comment ? { initial_comment: comment } : {}),
      });
    } else {
      if (!filePath) {
        throw new Error("Missing file path for Slack upload.");
      }
      upload = await this.app.client.files.uploadV2({
        channel_id: thread.channelId,
        file: filePath,
        filename: path.basename(filePath),
        ...(thread.threadTs ? { thread_ts: thread.threadTs } : {}),
        ...(title ? { title } : {}),
        ...(comment ? { initial_comment: comment } : {}),
      });
    }

    const uploadedFiles = collectUploadedFiles(upload);
    const firstFile = uploadedFiles[0] ?? null;
    return {
      fileId: firstFile?.id ?? null,
      permalink: getFileLink(firstFile),
      fileIds: uploadedFiles.map((file) => file?.id).filter(Boolean),
      permalinks: uploadedFiles.map((file) => getFileLink(file)).filter(Boolean),
    };
  }

  async resolveInboundFiles(message) {
    const resolvedFiles = [];
    for (const file of getMessageFiles(message)) {
      const direct = normalizeInboundFile(file);
      if (direct) {
        resolvedFiles.push(direct);
        continue;
      }

      const fileId = getSlackFileId(file);
      if (!fileId || !this.app.client?.files?.info) {
        continue;
      }

      try {
        const info = await this.app.client.files.info({ file: fileId });
        const enriched = normalizeInboundFile(info?.file);
        if (enriched) {
          resolvedFiles.push(enriched);
        }
      } catch (error) {
        console.error(`Failed to resolve Slack file info for ${fileId}:`, error);
      }
    }
    return resolvedFiles;
  }
}

function collectUploadedFiles(uploadResponse) {
  const outerFiles = Array.isArray(uploadResponse?.files) ? uploadResponse.files : [];
  const directFiles = outerFiles.filter(isSlackUploadedFile);
  if (directFiles.length > 0) {
    return directFiles;
  }

  return outerFiles.flatMap((entry) =>
    Array.isArray(entry?.files) ? entry.files.filter(isSlackUploadedFile) : [],
  );
}

function isSlackUploadedFile(entry) {
  return Boolean(
    entry
    && typeof entry === "object"
    && (
      typeof entry.id === "string"
      || typeof entry.permalink === "string"
      || typeof entry.url_private === "string"
      || typeof entry.url_private_download === "string"
    )
  );
}

function getFileLink(file) {
  return file?.permalink ?? file?.url_private_download ?? file?.url_private ?? null;
}
