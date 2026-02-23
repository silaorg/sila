import path from "node:path";
import { sanitizeThreadId } from "../channel-utils.js";

export function isTelegramUserTextMessage(ctx) {
  if (!ctx || typeof ctx !== "object") {
    return false;
  }
  if (!ctx.message || typeof ctx.message !== "object") {
    return false;
  }
  if (typeof ctx.message.text !== "string") {
    return false;
  }
  if (ctx.from && typeof ctx.from === "object" && ctx.from.is_bot) {
    return false;
  }
  return true;
}

export function isTelegramAttachmentMessage(ctx) {
  if (!ctx || typeof ctx !== "object") {
    return false;
  }
  if (!ctx.message || typeof ctx.message !== "object") {
    return false;
  }
  if (ctx.from && typeof ctx.from === "object" && ctx.from.is_bot) {
    return false;
  }
  return Boolean(ctx.message.document || ctx.message.photo || ctx.message.video);
}

export function isTelegramAudioMessage(ctx, kind) {
  if (!ctx || typeof ctx !== "object") {
    return false;
  }
  if (!ctx.message || typeof ctx.message !== "object") {
    return false;
  }
  if (ctx.from && typeof ctx.from === "object" && ctx.from.is_bot) {
    return false;
  }
  if (kind === "audio") {
    return Boolean(ctx.message.audio);
  }
  return Boolean(ctx.message.voice);
}

export function getMessageText(ctx) {
  return String(ctx.message.text || "").trim();
}

export function getMessageCaption(ctx) {
  if (!ctx.message || typeof ctx.message.caption !== "string") {
    return "";
  }
  return ctx.message.caption.trim();
}

export function getMessageDate(ctx) {
  const unixSeconds = Number(ctx.message?.date);
  if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
    return new Date(unixSeconds * 1000);
  }
  return new Date();
}

export function getUserId(ctx) {
  if (!ctx.from || typeof ctx.from !== "object") {
    return "";
  }
  if (typeof ctx.from.id === "undefined" || ctx.from.id === null) {
    return "";
  }
  return String(ctx.from.id);
}

export function getThreadContext(ctx) {
  const chatId = String(ctx.chat?.id ?? "");
  return {
    threadId: sanitizeThreadId(chatId),
    chatId,
  };
}

export function getAttachmentInfo(ctx, kind) {
  if (!ctx.message || typeof ctx.message !== "object") {
    return null;
  }

  if (kind === "document" && ctx.message.document) {
    return {
      fileId: String(ctx.message.document.file_id),
      fileName: String(ctx.message.document.file_name || `file_${Date.now()}`),
      label: "file",
    };
  }

  if (kind === "photo" && Array.isArray(ctx.message.photo) && ctx.message.photo.length > 0) {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    return {
      fileId: String(photo.file_id),
      fileName: `photo_${Date.now()}.jpg`,
      label: "photo",
    };
  }

  if (kind === "video" && ctx.message.video) {
    return {
      fileId: String(ctx.message.video.file_id),
      fileName: String(ctx.message.video.file_name || `video_${Date.now()}.mp4`),
      label: "video",
    };
  }

  return null;
}

export function getAudioInfo(ctx, kind) {
  if (!ctx.message || typeof ctx.message !== "object") {
    return null;
  }

  if (kind === "audio" && ctx.message.audio) {
    const fileName = String(ctx.message.audio.file_name || "").trim();
    const extension = path.extname(fileName) || ".mp3";
    return {
      fileId: String(ctx.message.audio.file_id),
      fileName: fileName || `audio_${Date.now()}${extension}`,
    };
  }

  if (kind === "voice" && ctx.message.voice) {
    return {
      fileId: String(ctx.message.voice.file_id),
      fileName: `voice_${Date.now()}.ogg`,
    };
  }

  return null;
}
