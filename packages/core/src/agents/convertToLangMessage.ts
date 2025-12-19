import { LangMessage } from "aiwrapper";
import type { ThreadMessage, ThreadMessageWithResolvedFiles } from "../models";
import type { ChatAppData } from "../spaces/ChatAppData";
import {
  type FileReference,
  FileResolver,
  type ResolvedFileInfo,
} from "../spaces/files/FileResolver";
import { transformFileReferencesToPaths } from "../spaces/files";

const MAX_TEXT_CHARACTERS = 10_000;

interface FileDescription {
  label: string;
  pathLabel: string;
  uri?: string;
}

const parseDataUrl = (
  dataUrl: string,
): { base64: string; mimeType?: string } => {
  try {
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (match && match[2]) {
      return { mimeType: match[1], base64: match[2] };
    }
  } catch {}
  return { base64: dataUrl };
};

export const extractTextFromDataUrl = (
  dataUrl: string | undefined,
): string | null => {
  if (!dataUrl) return null;
  try {
    const textDataUrlMatch = dataUrl.match(/^data:(text\/[^;]+);base64,(.+)$/);
    if (!textDataUrlMatch) return null;
    const [, , base64] = textDataUrlMatch;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
};

const toFileDescription = (
  file: { id: string; kind?: string; name?: string; path?: string },
  infoMap: Map<string, ResolvedFileInfo>,
): FileDescription => {
  const info = infoMap.get(file.id);
  const label = `${file.name ?? info?.name ?? "file"}${
    file.kind ? ` (${file.kind})` : ""
  }`;
  const pathLabel = file.path ?? info?.url ?? "path unavailable";
  return {
    label,
    pathLabel,
    uri: info?.url,
  };
};

const buildAttachmentsSummary = (
  files: Array<{ id: string; kind?: string; name?: string; path?: string }>,
  infoMap: Map<string, ResolvedFileInfo>,
): string => {
  if (!files.length) return "";

  const howManyFiles = `The user attached ${files.length} file${
    files.length > 1 ? "s" : ""
  }:`;
  const lines: string[] = [howManyFiles];
  for (const file of files) {
    const { label, pathLabel } = toFileDescription(file, infoMap);
    lines.push(`- ${label}`);
    lines.push(`  path: ${pathLabel}`);
  }

  return lines.join("\n");
};

const buildTextFileBlocks = (
  files: Array<
    {
      id: string;
      kind?: string;
      name?: string;
      path?: string;
      dataUrl?: string;
    }
  >,
  infoMap: Map<string, ResolvedFileInfo>,
  maxCharacters: number,
): string[] => {
  const sections: string[] = [];
  const decodedFiles: Array<
    {
      file: {
        id: string;
        kind?: string;
        name?: string;
        path?: string;
        dataUrl?: string;
      };
      decoded: string;
    }
  > = [];

  for (const file of files) {
    const decoded = extractTextFromDataUrl(file.dataUrl);
    if (!decoded) continue;
    decodedFiles.push({ file, decoded });
  }

  if (!decodedFiles.length) return sections;
  const totalDecodedChars = decodedFiles.reduce(
    (sum, { decoded }) => sum + decoded.length,
    0,
  );
  if (maxCharacters <= 0) return sections;

  const needsProportionalSlice = totalDecodedChars > maxCharacters;
  // Scale each file's slice by its share of total decoded chars; carry handles rounding so we spend the full budget.
  const scale = needsProportionalSlice ? maxCharacters / totalDecodedChars : 1;
  let remaining = maxCharacters;
  let carry = 0;

  for (let i = 0; i < decodedFiles.length; i++) {
    const { file, decoded } = decodedFiles[i];
    const totalChars = decoded.length;

    let take = totalChars;
    if (needsProportionalSlice) {
      if (i === decodedFiles.length - 1) {
        take = Math.max(0, Math.min(totalChars, remaining));
      } else {
        const exactShare = totalChars * scale + carry;
        take = Math.max(0, Math.min(totalChars, Math.floor(exactShare)));
        carry = exactShare - take;
        remaining -= take;
        if (remaining < 0) remaining = 0;
      }
    }

    const snippet = decoded.slice(0, take);

    const { label, pathLabel } = toFileDescription(file, infoMap);
    sections.push(
      [
        `--- File: ${label} ---`,
        `Path: ${pathLabel}`,
        `Characters shown: ${take} of ${totalChars}`,
        snippet,
      ].join("\n"),
    );
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
  const normalizedRole =
    (message.role === "assistant" ? "assistant" : "user") as
      | "assistant"
      | "user";
  const fileRefs = Array.isArray(message.files)
    ? (message.files as FileReference[])
    : [];
  const resolved: ThreadMessageWithResolvedFiles = await data
    .resolveMessageFiles(message);
  const resolvedFiles = resolved.files ?? [];

  // AI-time: models should see familiar file: URIs, not storage-only fref: URIs.
  // This is a view transform only (we do not persist the rewritten text).
  let messageText = message.text || "";
  try {
    if (messageText.includes("fref:")) {
      const space = data.getSpace();
      const { markdown } = await transformFileReferencesToPaths(messageText, {
        space,
        fileResolver,
        candidateTreeIds: [data.threadId, space.getId()],
      });
      messageText = markdown;
    }
  } catch {
    // ignore
  }

  if (resolvedFiles.length === 0) {
    return new LangMessage(
      normalizedRole,
      messageText,
      message.meta ?? {},
    );
  }

  const fileInfos = fileRefs.length > 0
    ? await fileResolver.getFilesInfo(fileRefs)
    : [];
  const infoMap = new Map<string, ResolvedFileInfo>(
    fileInfos.map((info) => [info.id, info]),
  );

  const images = resolvedFiles.filter((f) => f?.kind === "image");
  const textFiles = resolvedFiles.filter((f) => f?.kind === "text");

  const attachmentsSummary = buildAttachmentsSummary(resolvedFiles, infoMap);
  const textBlocks = buildTextFileBlocks(textFiles, infoMap, maxTextCharacters);

  const attachements = "<attachments>\n" +
    [attachmentsSummary, ...textBlocks].join("\n\n") + "\n</attachments>";
    
  const combinedText = [messageText, attachements].join("\n\n");

  if (supportsVision && images.length > 0) {
    const items: Array<
      | { type: "text"; text: string }
      | {
        type: "image";
        base64: string;
        mimeType?: string;
        width?: number;
        height?: number;
        metadata?: Record<string, any>;
      }
    > = [];

    if (combinedText.trim().length > 0) {
      items.push({ type: "text", text: combinedText });
    }

    for (const img of images) {
      const { base64, mimeType } = parseDataUrl(img.dataUrl);
      const metadata: Record<string, any> = {};
      const { label, pathLabel } = toFileDescription(img, infoMap);
      metadata.label = label;
      metadata.path = pathLabel;

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

  return new LangMessage(normalizedRole, content || "", message.meta ?? {});
};
