import path from "node:path";
import { toAgentRelativePath } from "../channel-utils.js";
import {
  getAttachmentInfo,
  getAudioInfo,
  getMessageCaption,
  getMessageDate,
  prependReplyContext,
} from "./telegram-input-parser.js";

export async function buildTelegramAttachmentContent(input) {
  const attachment = getAttachmentInfo(input.ctx, input.kind);
  if (!attachment) {
    return null;
  }

  const threadDir = path.join(input.channelPath, input.threadId);
  const localPath = await input.storeFile({
    fileId: attachment.fileId,
    originalName: attachment.fileName,
    threadDir,
    createdAt: getMessageDate(input.ctx),
    telegram: input.ctx.telegram,
  });
  return withCaptionAndReplyContext(
    input.ctx,
    `[Uploaded a ${attachment.label}: ${toAgentRelativePath(localPath, threadDir)}]`,
  );
}

export async function buildTelegramAudioContent(input) {
  const audio = getAudioInfo(input.ctx, input.kind);
  if (!audio) {
    return null;
  }

  const threadDir = path.join(input.channelPath, input.threadId);
  const localPath = await input.storeFile({
    fileId: audio.fileId,
    originalName: audio.fileName,
    threadDir,
    createdAt: getMessageDate(input.ctx),
    telegram: input.ctx.telegram,
  });
  let text = `[Uploaded an audio file: ${toAgentRelativePath(localPath, threadDir)}]`;

  try {
    const transcription = await input.transcribe(input.openAiClient, localPath);
    if (transcription) {
      text += `\n\n[Audio transcription]\n${transcription}`;
    }
  } catch (error) {
    console.error("Failed to transcribe Telegram audio:", error);
  }

  return withCaptionAndReplyContext(input.ctx, text);
}

function withCaptionAndReplyContext(ctx, text) {
  const caption = getMessageCaption(ctx);
  const withCaption = caption ? `${text}\n\n${caption}` : text;
  return prependReplyContext(ctx, withCaption);
}
