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
  } catch { }
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
  const label = `${file.name ?? info?.name ?? "file"}${file.kind ? ` (${file.kind})` : ""
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

  const howManyFiles = `The user attached ${files.length} file${files.length > 1 ? "s" : ""
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
    (message.role === "tool-results"
      ? "tool-results"
      : message.role === "assistant"
        ? "assistant"
        : "user") as "assistant" | "user" | "tool-results";
  const fileRefs = Array.isArray(message.files)
    ? (message.files as FileReference[])
    : [];
  const toolRequests = message.toolRequests ?? [];
  const toolResults = message.toolResults ?? [];

  const resolved: ThreadMessageWithResolvedFiles = await data
    .resolveMessageFiles(message);
  const resolvedFiles = resolved.files ?? [];

  if (fileRefs.length > 0 && resolvedFiles.length === 0) {
    console.warn(`A message has ${fileRefs.length} file reference(s) but none resolved to files. This may indicate a file resolution issue.`);
  }

  // Models should see file URIs, not storage-only freferences (ids). So they can operate on URIs (such as file paths) with tools.
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
  } catch(error) {
    console.error(`Failed to transform file references in a message, error:`, error);
  }

  const hasFiles = resolvedFiles.length > 0;
  const fileInfos = hasFiles && fileRefs.length > 0
    ? await fileResolver.getFilesInfo(fileRefs)
    : [];
  const infoMap = new Map<string, ResolvedFileInfo>(
    fileInfos.map((info) => [info.id, info]),
  );

  const images = hasFiles
    ? resolvedFiles.filter((f) => f?.kind === "image")
    : [];
  const textFiles = hasFiles
    ? resolvedFiles.filter((f) => f?.kind === "text")
    : [];

  let combinedText = messageText;
  if (hasFiles) {
    const attachmentsSummary = buildAttachmentsSummary(resolvedFiles, infoMap);
    const textBlocks = buildTextFileBlocks(
      textFiles,
      infoMap,
      maxTextCharacters,
    );

    const attachements = "<attachments>\n" +
      [attachmentsSummary, ...textBlocks].join("\n\n") + "\n</attachments>";
    combinedText = [messageText, attachements].join("\n\n");
  }

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
      | {
        type: "tool";
        name: string;
        callId: string;
        arguments: Record<string, any>;
      }
      | { type: "tool-result"; name: string; callId: string; result: any }
    > = [];

    if (combinedText.trim().length > 0) {
      items.push({ type: "text", text: combinedText });
    }

    for (const img of images) {
      // Only include images with valid dataUrl
      if (!img.dataUrl || typeof img.dataUrl !== 'string' || img.dataUrl.trim().length === 0) {
        console.warn('Skipping image without valid dataUrl:', img.id, img.name);
        continue;
      }

      const { base64, mimeType } = parseDataUrl(img.dataUrl);

      // Ensure base64 data is valid
      if (!base64 || base64.trim().length === 0) {
        console.warn('Skipping image with invalid base64 data:', img.id, img.name);
        continue;
      }

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

    if (toolRequests.length > 0) {
      items.push(
        ...toolRequests.map((request) => ({
          type: "tool" as const,
          name: request.name,
          callId: request.callId,
          arguments: request.arguments,
        })),
      );
    }

    if (toolResults.length > 0) {
      items.push(
        ...toolResults.map((result) => ({
          type: "tool-result" as const,
          name: result.name,
          callId: (result as any).toolId ?? "",
          result: result.result,
        })),
      );
    }

    // If we have valid images, return the multi-part message
    // Otherwise fall through to text-only message
    if (items.some(item => item.type === "image")) {
      return new LangMessage(normalizedRole, items, message.meta ?? {});
    }
  }

  if (toolRequests.length > 0 || toolResults.length > 0) {
    const items: Array<
      | { type: "text"; text: string }
      | {
        type: "tool";
        name: string;
        callId: string;
        arguments: Record<string, any>;
      }
      | { type: "tool-result"; name: string; callId: string; result: any }
    > = [];
    if (combinedText.trim().length > 0) {
      items.push({ type: "text", text: combinedText });
    }
    if (toolRequests.length > 0) {
      items.push(
        ...toolRequests.map((request) => ({
          type: "tool" as const,
          name: request.name,
          callId: request.callId,
          arguments: request.arguments,
        })),
      );
    }
    if (toolResults.length > 0) {
      items.push(
        ...toolResults.map((result) => ({
          type: "tool-result" as const,
          name: result.name,
          callId: (result as any).toolId ?? "",
          result: result.result,
        })),
      );
    }
    return new LangMessage(normalizedRole, items, message.meta ?? {});
  }

  return new LangMessage(normalizedRole, combinedText || "", message.meta ?? {});
};
