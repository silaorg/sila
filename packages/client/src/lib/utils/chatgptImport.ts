// We avoid static imports to prevent tooling resolution issues in some environments
// and load peer package code dynamically at runtime.

// Lazy import parser to avoid bloating initial bundle
async function loadParser(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return await import("chatgpt-export-parser");
}

type ParsedAttachment = {
  name?: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  content?: string;
};

type ParsedMessage = {
  role: "user" | "assistant" | "system";
  text?: string;
  createdAt?: number | string;
  attachments?: ParsedAttachment[];
  files?: ParsedAttachment[]; // alternate field name
};

type ParsedConversation = {
  id: string; // ChatGPT conversation id
  title?: string;
  messages: ParsedMessage[];
};

export type ImportResult = {
  created: number;
  skipped: number;
  updated: number;
};

function findExistingChatByChatgptId(space: any, chatgptId: string): any | undefined {
  const refIds: string[] = space.getAppTreeIds();
  for (const refId of refIds) {
    const refVertex = space.getVertex(refId);
    if (!refVertex) continue;
    const existingId = refVertex.getProperty("chatgptId") as string | undefined;
    if (existingId !== chatgptId) continue;
    const tid = refVertex.getProperty("tid") as string | undefined;
    if (!tid) continue;
    const appTree = space.getAppTree(tid);
    if (appTree) return appTree;
  }
  return undefined;
}

type LocalAttachmentPreview = {
  id: string;
  kind: 'image' | 'text' | 'file';
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  content?: string;
};

function toAttachmentPreview(att: ParsedAttachment): LocalAttachmentPreview {
  const id = (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const name = att.name ?? "file";
  const mimeType = att.mimeType ?? (att.dataUrl?.split(":")[1]?.split(";")[0] ?? "application/octet-stream");
  const size = att.size ?? 0;
  const kind: LocalAttachmentPreview["kind"] = att.dataUrl ? "image" : att.content ? "text" : "file";
  const preview: LocalAttachmentPreview = {
    id,
    kind,
    name,
    mimeType,
    size,
  };
  if (att.dataUrl) preview.dataUrl = att.dataUrl;
  if (att.content) preview.content = att.content;
  return preview;
}

export async function importChatGptZipIntoSpace(space: any, zipFile: File): Promise<ImportResult> {
  const parser: any = await loadParser();
  const core: any = await import("@sila/core");
  // Try common entry points
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed: { conversations: ParsedConversation[] } = await (
    parser.parseZip ? parser.parseZip(zipFile)
    : parser.parse ? parser.parse(zipFile)
    : parser.default ? parser.default(zipFile)
    : Promise.reject(new Error("chatgpt-export-parser: no parse function found"))
  );

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const conv of parsed.conversations || []) {
    if (!conv?.id) continue;
    const existing = findExistingChatByChatgptId(space, conv.id);
    if (existing) {
      // v1: skip updates
      skipped += 1;
      continue;
    }

    const appTree = core.ChatAppData.createNewChatTree(space, "default");
    const chatData = new core.ChatAppData(space, appTree);
    chatData.title = conv.title || "Imported chat";

    // Mark identifiers for duplicate detection
    const root = appTree.tree.root!;
    root.setProperty("chatgptId", conv.id);
    const refVertex = space.getVertexReferencingAppTree(appTree.getId());
    if (refVertex) {
      refVertex.setProperty("chatgptId", conv.id);
    }

    for (const m of conv.messages || []) {
      const role = m.role === "assistant" ? "assistant" : "user"; // ignore system for v1
      const text = m.text || "";
      const rawAtts = (m.attachments && m.attachments.length > 0)
        ? m.attachments
        : (m.files && m.files.length > 0)
        ? m.files
        : [];
      const mapped = rawAtts.length > 0 ? rawAtts.map(toAttachmentPreview) : [];
      const onlySupported = mapped.filter(a => !!a.dataUrl || !!a.content);
      const attachments = onlySupported.length > 0 ? onlySupported : undefined;
      await chatData.newMessage(role, text, undefined, attachments);
    }

    created += 1;
  }

  return { created, skipped, updated };
}

