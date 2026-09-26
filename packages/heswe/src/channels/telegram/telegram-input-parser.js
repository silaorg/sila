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

export function prependReplyContext(ctx, text) {
  const replyContext = getReplyContext(ctx);
  const trimmedText = String(text || "").trim();
  if (!replyContext) {
    return trimmedText;
  }
  if (!trimmedText) {
    return replyContext;
  }
  return `${replyContext}\n\n${trimmedText}`;
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

function getReplyContext(ctx) {
  if (!ctx || typeof ctx !== "object") {
    return "";
  }

  const source = getReplySource(ctx);
  if (!source) {
    return "";
  }

  const sourceLabel = getReplySourceLabel(source);
  const replyText = getQuoteText(ctx.message) || getReplyText(source);
  if (!sourceLabel) {
    if (!replyText) {
      return "[Reply context]";
    }
    return `[Reply context]\n${replyText}`;
  }
  if (!replyText) {
    return `[Reply context: ${sourceLabel}]`;
  }
  return `[Reply context: ${sourceLabel}]\n${replyText}`;
}

function getReplySource(ctx) {
  if (!ctx.message || typeof ctx.message !== "object") {
    return null;
  }
  if (ctx.message.reply_to_message && typeof ctx.message.reply_to_message === "object") {
    return ctx.message.reply_to_message;
  }
  if (ctx.message.external_reply && typeof ctx.message.external_reply === "object") {
    return ctx.message.external_reply;
  }
  return null;
}

function getReplyText(message) {
  if (!message || typeof message !== "object") {
    return "";
  }

  const text = String(message.text || "").trim();
  if (text) {
    return text;
  }

  const caption = String(message.caption || "").trim();
  if (caption) {
    return caption;
  }

  const messageDate = Number(message.date);
  if (Number.isFinite(messageDate) && messageDate === 0) {
    return "[Replied message is inaccessible]";
  }

  return getReplyAttachmentHint(message);
}

function getQuoteText(message) {
  if (!message || typeof message !== "object") {
    return "";
  }
  return String(message.quote?.text || "").trim();
}

function getReplyAttachmentHint(message) {
  if (message.photo) {
    return "[Photo message]";
  }
  if (message.video) {
    return "[Video message]";
  }
  if (message.document) {
    return "[Document message]";
  }
  if (message.audio) {
    return "[Audio message]";
  }
  if (message.voice) {
    return "[Voice message]";
  }
  if (message.animation) {
    return "[Animation message]";
  }
  if (message.sticker) {
    return "[Sticker message]";
  }
  return "";
}

function getReplySourceLabel(message) {
  if (!message || typeof message !== "object") {
    return "";
  }

  const parts = [];
  const messageId = Number(message.message_id);
  if (Number.isFinite(messageId) && messageId > 0) {
    parts.push(`#${messageId}`);
  }

  const sender = getSenderLabel(message);
  if (sender) {
    parts.push(`from ${sender}`);
  }
  return parts.join(" ");
}

function getSenderLabel(message) {
  if (!message || typeof message !== "object") {
    return "";
  }

  const fromUser = formatUser(message.from);
  if (fromUser) {
    return fromUser;
  }

  const senderChatTitle = String(message.sender_chat?.title || "").trim();
  if (senderChatTitle) {
    return senderChatTitle;
  }

  const senderChatUsername = String(message.sender_chat?.username || "").trim();
  if (senderChatUsername) {
    return `@${senderChatUsername}`;
  }

  const originSender = formatUser(message.origin?.sender_user);
  if (originSender) {
    return originSender;
  }

  const hiddenName = String(message.origin?.sender_user_name || "").trim();
  if (hiddenName) {
    return hiddenName;
  }

  const originSenderChatTitle = String(message.origin?.sender_chat?.title || "").trim();
  if (originSenderChatTitle) {
    return originSenderChatTitle;
  }

  const originSenderChatUsername = String(message.origin?.sender_chat?.username || "").trim();
  if (originSenderChatUsername) {
    return `@${originSenderChatUsername}`;
  }

  const originChatTitle = String(message.origin?.chat?.title || "").trim();
  if (originChatTitle) {
    return originChatTitle;
  }

  const originChatUsername = String(message.origin?.chat?.username || "").trim();
  if (originChatUsername) {
    return `@${originChatUsername}`;
  }
  return "";
}

function formatUser(user) {
  if (!user || typeof user !== "object") {
    return "";
  }

  const username = String(user.username || "").trim();
  if (username) {
    return `@${username}`;
  }

  const fullName = [user.first_name, user.last_name]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();
  if (fullName) {
    return fullName;
  }

  if (typeof user.id === "number" || (typeof user.id === "string" && user.id.length > 0)) {
    return `id=${user.id}`;
  }

  return "";
}
