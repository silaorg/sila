import { LangMessage } from "aiwrapper";
import type { ThreadMessage, ThreadMessageWithResolvedFiles } from "../models";
import type { ChatAppData } from "../spaces/ChatAppData";
import { FileResolver, type FileReference, type ResolvedFileInfo } from "../spaces/files/FileResolver";

const MAX_TEXT_CHARACTERS = 10_000;

interface FileDescription {
  label: string;
  pathLabel: string;
  uri?: string;
}

const parseDataUrl = (dataUrl: string): { base64: string; mimeType?: string } => {
  try {
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (match && match[2]) {
      return { mimeType: match[1], base64: match[2] };
    }
  } catch { }
  return { base64: dataUrl };
};

export const extractTextFromDataUrl = (dataUrl: string | undefined): string | null => {
  if (!dataUrl) return null;
  try {
    const textDataUrlMatch = dataUrl.match(/^data:(text\/[^;]+);base64,(.+)$/);
    if (!textDataUrlMatch) return null;
    const [, , base64] = textDataUrlMatch;
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
};

const toFileDescription = (
  file: { id: string; kind?: string; name?: string; path?: string },
  infoMap: Map<string, ResolvedFileInfo>
): FileDescription => {
  const info = infoMap.get(file.id);
  const label = `${file.name ?? info?.name ?? "file"}${file.kind ? ` (${file.kind})` : ""}`;
  const pathLabel = file.path ?? info?.url ?? "path unavailable";
  return {
    label,
    pathLabel,
    uri: info?.url,
  };
};

const buildAttachmentsSummary = (files: Array<{ id: string; kind?: string; name?: string; path?: string }>, infoMap: Map<string, ResolvedFileInfo>): string => {
  if (!files.length) return "";

  const lines: string[] = ["Attachments:"];
  for (const file of files) {
    const { label, pathLabel, uri } = toFileDescription(file, infoMap);
    lines.push(`- ${label}`);
    lines.push(`  path: ${pathLabel}`);
    lines.push(`  uri: ${uri ?? "unavailable"}`);
  }

  return lines.join("\n");
};

const buildTextFileBlocks = (
  files: Array<{ id: string; kind?: string; name?: string; path?: string; dataUrl?: string }>,
  infoMap: Map<string, ResolvedFileInfo>,
  maxCharacters: number
): string[] => {
  const sections: string[] = [];
  let remaining = maxCharacters;

  for (const file of files) {
    const decoded = extractTextFromDataUrl(file.dataUrl);
    if (!decoded) continue;

    const totalChars = decoded.length;
    const take = Math.max(0, Math.min(remaining, totalChars));
    const snippet = decoded.slice(0, take);
    remaining -= take;

    const { label, pathLabel, uri } = toFileDescription(file, infoMap);
    sections.push(
      [
        `--- File: ${label} ---`,
        `Path: ${pathLabel}`,
        `URI: ${uri ?? "unavailable"}`,
        `Total characters: ${totalChars}`,
        `Showing ${take} characters:`,
        snippet,
      ].join("\n")
    );

    if (remaining <= 0) {
      break;
    }
  }

  return sections;
};

export interface ConvertToLangMessageParams {
  message: ThreadMessage;
  data: ChatAppData;
  fileResolver: FileResolver;
  supportsVision?: boolean;
  maxTextCharacters?: number;
}

export const convertToLangMessage = async ({
  message,
  data,
  fileResolver,
  supportsVision = true,
  maxTextCharacters = MAX_TEXT_CHARACTERS,
}: ConvertToLangMessageParams): Promise<LangMessage> => {
  const normalizedRole = (message.role === "assistant" ? "assistant" : "user") as "assistant" | "user";
  const fileRefs = Array.isArray(message.files) ? (message.files as FileReference[]) : [];
  const resolved: ThreadMessageWithResolvedFiles = await data.resolveMessageFiles(message);
  const resolvedFiles = resolved.files ?? [];
  const fileInfos = fileRefs.length > 0 ? await fileResolver.getFilesInfo(fileRefs) : [];
  const infoMap = new Map<string, ResolvedFileInfo>(fileInfos.map((info) => [info.id, info]));

  const images = resolvedFiles.filter((f) => f?.kind === "image");
  const textFiles = resolvedFiles.filter((f) => f?.kind === "text");
  const attachmentsSummary = buildAttachmentsSummary(resolvedFiles, infoMap);
  const textBlocks = buildTextFileBlocks(textFiles, infoMap, maxTextCharacters);

  const textSections = [message.text || "", attachmentsSummary, textBlocks.join("\n\n")].filter(Boolean);
  const combinedText = textSections.join("\n\n");

  if (supportsVision && images.length > 0) {
    const items: Array<
      | { type: "text"; text: string }
      | { type: "image"; base64: string; mimeType?: string; width?: number; height?: number; metadata?: Record<string, any> }
    > = [];

    if (combinedText.trim().length > 0) {
      items.push({ type: "text", text: combinedText });
    }

    for (const img of images) {
      const { base64, mimeType } = parseDataUrl(img.dataUrl);
      const metadata: Record<string, any> = {};
      const { label, pathLabel, uri } = toFileDescription(img, infoMap);
      metadata.label = label;
      metadata.path = pathLabel;
      if (uri) {
        metadata.uri = uri;
      }

      items.push({
        type: "image",
        base64,
        mimeType,
        width: img.width,
        height: img.height,
        metadata,
      });
    }

    return new LangMessage(normalizedRole, items, message.meta ?? {});
  }

  let content = combinedText;

  if (images.length > 0) {
    const imageNotes = images
      .map((img) => {
        const { label, pathLabel, uri } = toFileDescription(img, infoMap);
        const uriText = uri ? `, uri: ${uri}` : "";
        return `- ${label} (path: ${pathLabel}${uriText})`;
      })
      .join("\n");
    const prefix = content ? "\n\n" : "";
    content += `${prefix}Images attached (vision disabled):\n${imageNotes}`;
  }

  return new LangMessage(normalizedRole, content || "", message.meta ?? {});
};
