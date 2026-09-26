import { sanitizeThreadId } from "../channel-utils.js";

export function isSlackUserMessage(message) {
  if (!message || typeof message !== "object" || message.bot_id) {
    return false;
  }
  if (typeof message.subtype === "string" && message.subtype !== "file_share") {
    return false;
  }
  return typeof message.user === "string" && message.user.length > 0;
}

export function getMessageText(message) {
  return typeof message.text === "string" ? message.text.trim() : "";
}

export function normalizeIncomingText(text, botUserId) {
  if (!botUserId) {
    return text.trim();
  }
  return text.split(`<@${botUserId}>`).join(" ").trim();
}

export function getMessageDate(message) {
  const timestamp = String(message?.ts ?? "").trim();
  const unixSeconds = Number(timestamp.split(".")[0]);
  return Number.isFinite(unixSeconds) && unixSeconds > 0
    ? new Date(unixSeconds * 1000)
    : new Date();
}

export function getThreadContext(message) {
  const channelId = String(message.channel);
  const rootTs = message.thread_ts === undefined || message.thread_ts === null || message.thread_ts === ""
    ? null
    : String(message.thread_ts);
  if (rootTs) {
    return {
      threadId: sanitizeThreadId(`${channelId}_${rootTs}`),
      channelId,
      threadTs: rootTs,
    };
  }

  const messageTs = typeof message.ts === "string" && message.ts.trim().length
    ? message.ts.trim()
    : null;
  if (messageTs) {
    return {
      threadId: sanitizeThreadId(`${channelId}_${messageTs}`),
      channelId,
      threadTs: messageTs,
    };
  }

  return {
    threadId: sanitizeThreadId(`${channelId}_main`),
    channelId,
    threadTs: null,
  };
}

export function hasSlackFiles(message) {
  return getMessageFiles(message).length > 0;
}

export function getMessageFiles(message) {
  return Array.isArray(message?.files)
    ? message.files.filter((file) => file && typeof file === "object")
    : [];
}

export function normalizeInboundFile(file) {
  if (!file || typeof file !== "object") {
    return null;
  }

  const fileUrl = String(file.url_private_download || file.url_private || "").trim();
  if (!fileUrl) {
    return null;
  }

  return {
    fileName: getSlackFileName(file),
    fileUrl,
    label: getSlackFileLabel(file),
  };
}

export function getSlackFileId(file) {
  return String(file?.id || "").trim();
}

function getSlackFileName(file) {
  const name = String(file.name || file.title || "").trim();
  if (name) {
    return name;
  }
  const fileId = getSlackFileId(file);
  return fileId ? `${fileId}.bin` : `file_${Date.now()}`;
}

function getSlackFileLabel(file) {
  const mimeType = String(file.mimetype || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}
