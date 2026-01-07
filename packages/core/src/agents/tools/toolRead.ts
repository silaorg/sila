import type { ProxyFetch } from "@sila/core";
import { LangToolWithHandler } from "aiwrapper";
import type { AppTree } from "../../spaces/AppTree";
import { createWorkspaceProxyFetch, isTextLikeMime } from "./workspaceProxyFetch";
import type { AgentTool } from "./AgentTool";
import Defuddle from "defuddle/markdown";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

const DEFAULT_MAX_CHARS = 8_000;
const MAX_MAX_CHARS = 20_000;

const READ_CACHE_TTL_MS = 5 * 60 * 1000;
const READ_CACHE_MAX_ENTRIES = 50;

type ReadKind = "html" | "text" | "pdf" | "unknown";

type ReadToolCursorV1 = {
  v: 1;
  uri: string;
  cacheKey: string;
  offset: number;
};

type ReadCacheEntry = {
  createdAt: number;
  lastAccessAt: number;
  expiresAt: number;
  uri: string;
  cacheKey: string;
  kind: ReadKind;
  contentType: string;
  content: string;
};

const readCache = new Map<string, ReadCacheEntry>();

function buildReadInstructions(): string {
  return [
    "The `read` tool is paginated.",
    `- By default it returns up to ${DEFAULT_MAX_CHARS} characters.`,
    "- If the result has `truncated=true`, call `read` again with the same `uri` and `cursor=next_cursor` to continue.",
    "- Stop when `truncated=false`.",
    "- Prefer reading only what you need to answer the user."
  ].join("\n");
}

export const toolRead: AgentTool = {
  name: "read",
  instructions: buildReadInstructions(),
  description:
    "Fetch and read a resource by its URI. It could be a URL of a website or an internal file in the workspace. If you need to read a local file in the chat, referece it as a `file:document.md` and if in the workspace assets: `file:///assets/document.md`.",
  parameters: {
    type: "object",
    properties: {
      uri: { type: "string", description: "The URI should start with the scheme (http, https, sila, etc.)" },
      cursor: { type: "string", description: "Opaque pagination cursor returned by a previous read call." },
      max_chars: { type: "number", description: `Max characters to return (default: ${DEFAULT_MAX_CHARS}).` },
    },
    required: ["uri"]
  },
  getTool(services, appTree: AppTree): LangToolWithHandler {
    const fetchImpl: ProxyFetch = createWorkspaceProxyFetch(services.space, appTree);
    return {
      name: this.name,
      description: this.description!,
      parameters: this.parameters!,
      handler: async (args: Record<string, any>) => {
        const uri = args.uri as string | undefined;
        const cursorRaw = args.cursor as string | undefined;
        const maxChars = clampMaxChars(args.max_chars);
        const now = Date.now();

        if (!uri || typeof uri !== "string") {
          throw new Error("Invalid URI, needs to be a string");
        }

        const scheme = uri.split("://")[0];
        if (!scheme) {
          throw new Error("Invalid URI, needs to start with a scheme, such as https://");
        }

        // Fast-path: if we have a valid cursor and cache entry, paginate without refetching/reparsing.
        if (cursorRaw) {
          const cursor = decodeCursor(cursorRaw);
          if (cursor && cursor.uri === uri) {
            const cached = getCached(cursor.cacheKey, now);
            if (cached) {
              return paginateResult({
                uri,
                kind: cached.kind,
                contentType: cached.contentType,
                fullText: cached.content,
                offset: cursor.offset,
                maxChars,
                cacheKey: cached.cacheKey,
              });
            }
          }
        }

        // Cache miss (or cursor invalid/expired): fetch and extract, then paginate from the start.
        const res = await fetchImpl(uri);
        if (!res.ok) {
          throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get("content-type") || "";
        const etag = (res.headers.get("etag") || "").trim();
        const lastModified = (res.headers.get("last-modified") || "").trim();

        const { kind, text } = await extractReadableText({ uri, res, contentType });
        const cacheKey = buildCacheKey({ uri, kind, contentType, etag, lastModified });

        setCached(
          cacheKey,
          {
            createdAt: now,
            lastAccessAt: now,
            expiresAt: now + READ_CACHE_TTL_MS,
            uri,
            cacheKey,
            kind,
            contentType,
            content: text,
          },
          now
        );

        return paginateResult({
          uri,
          kind,
          contentType,
          fullText: text,
          offset: 0,
          maxChars,
          cacheKey,
        });
      }
    };
  }
};

async function extractReadableText(opts: {
  uri: string;
  res: Response;
  contentType: string;
}): Promise<{ kind: ReadKind; text: string }> {
  const { uri, res, contentType } = opts;

  // PDF
  if (contentType.includes("application/pdf")) {
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return { kind: "pdf", text: await extractPdfText(bytes) };
  }

  // Non-text
  if (contentType && !isTextLikeMime(contentType)) {
    throw new Error(
      `Cannot read binary file. The read tool only supports text files (got content-type: ${contentType}). Use the look tool for images.`
    );
  }

  // Plain text
  if (contentType.startsWith("text/plain")) {
    return { kind: "text", text: await res.text() };
  }

  // HTML-ish (fallback)
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const defuddle = new Defuddle(doc, { url: uri, separateMarkdown: true });
  const parsed = defuddle.parse();
  return { kind: "html", text: parsed.contentMarkdown || parsed.content || "" };
}

function paginateResult(opts: {
  uri: string;
  kind: ReadKind;
  contentType: string;
  fullText: string;
  offset: number;
  maxChars: number;
  cacheKey: string;
}): {
  uri: string;
  content: string;
  truncated: boolean;
  next_cursor?: string;
  kind?: ReadKind;
  content_type?: string;
} {
  const { uri, kind, contentType, fullText, offset, maxChars, cacheKey } = opts;
  const safeOffset = Math.max(0, Math.min(offset, fullText.length));
  const end = Math.min(fullText.length, safeOffset + maxChars);
  const content = fullText.slice(safeOffset, end);
  const truncated = end < fullText.length;

  return {
    uri,
    content,
    truncated,
    next_cursor: truncated
      ? encodeCursor({ v: 1, uri, cacheKey, offset: end })
      : undefined,
    kind,
    content_type: contentType || undefined,
  };
}

function clampMaxChars(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_CHARS;
  }
  return Math.max(1, Math.min(Math.floor(raw), MAX_MAX_CHARS));
}

function buildCacheKey(opts: {
  uri: string;
  kind: ReadKind;
  contentType: string;
  etag: string;
  lastModified: string;
}): string {
  const { uri, kind, contentType, etag, lastModified } = opts;
  // Keep it stable and safe to embed into cursors.
  return [
    "v1",
    kind,
    uri,
    contentType || "",
    etag || "",
    lastModified || "",
  ].join("|");
}

function getCached(cacheKey: string, now: number): ReadCacheEntry | null {
  pruneCache(now);
  const entry = readCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    readCache.delete(cacheKey);
    return null;
  }
  entry.lastAccessAt = now;
  return entry;
}

function setCached(cacheKey: string, entry: ReadCacheEntry, now: number): void {
  pruneCache(now);
  readCache.set(cacheKey, entry);
  enforceCacheLimits(now);
}

function pruneCache(now: number): void {
  for (const [key, entry] of readCache.entries()) {
    if (entry.expiresAt <= now) {
      readCache.delete(key);
    }
  }
}

function enforceCacheLimits(now: number): void {
  if (readCache.size <= READ_CACHE_MAX_ENTRIES) return;

  const entries = Array.from(readCache.entries());
  entries.sort((a, b) => a[1].lastAccessAt - b[1].lastAccessAt);
  while (readCache.size > READ_CACHE_MAX_ENTRIES) {
    const victim = entries.shift();
    if (!victim) break;
    readCache.delete(victim[0]);
  }
  pruneCache(now);
}

function encodeCursor(cursor: ReadToolCursorV1): string {
  const json = JSON.stringify(cursor);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64");
  }
  // Browser fallback
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeCursor(raw: string): ReadToolCursorV1 | null {
  try {
    const json =
      typeof Buffer !== "undefined"
        ? Buffer.from(raw, "base64").toString("utf-8")
        : decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(json) as ReadToolCursorV1;
    if (!parsed || parsed.v !== 1) return null;
    if (!parsed.uri || !parsed.cacheKey || typeof parsed.offset !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  ensurePdfJsWorkerConfigured();

  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF too large for read tool (size=${bytes.byteLength} bytes, limit=${MAX_PDF_BYTES})`
    );
  }

  // Quick sanity check to catch proxy/cors layers corrupting binary payloads.
  // A valid PDF should start with "%PDF-".
  if (
    bytes.byteLength < 5 ||
    bytes[0] !== 0x25 || // %
    bytes[1] !== 0x50 || // P
    bytes[2] !== 0x44 || // D
    bytes[3] !== 0x46 || // F
    bytes[4] !== 0x2d    // -
  ) {
    const head = Array.from(bytes.slice(0, 32))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    throw new Error(
      `Expected a PDF (missing %PDF- header). First 32 bytes: ${head}`
    );
  }

  const pdf = await getDocument({ data: bytes }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const pageData = await pdf.getPage(page);
    const text = await pageData.getTextContent();
    const items = (text as any).items as Array<{ str?: string }>;
    const pageText = items
      .map((item) => item.str ?? "")
      .join(" ");
    parts.push(`\n\n# Page ${page}\n${pageText}`);
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    parts.push(`\n\n# Note\nStopped at page ${MAX_PDF_PAGES} of ${pdf.numPages}.`);
  }

  return parts.join("\n").trim();
}

function ensurePdfJsWorkerConfigured(): void {
  // In bundler environments (Vite/Electron renderer), PDF.js needs an explicit worker URL.
  // If unset, PDF.js throws: `No "GlobalWorkerOptions.workerSrc" specified.`
  // We only set this if missing, so embedders can override it.
  if (GlobalWorkerOptions.workerSrc) return;

  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();
}
