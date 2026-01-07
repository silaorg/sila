import type { ProxyFetch } from "@sila/core";
import { LangToolWithHandler } from "aiwrapper";
import type { AppTree } from "../../spaces/AppTree";
import { createWorkspaceProxyFetch, isTextLikeMime } from "./workspaceProxyFetch";
import type { AgentTool } from "./AgentTool";
import Defuddle from "defuddle/markdown";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// PDF.js requires an explicit worker URL in bundler environments (Vite/Electron renderer).
// Without it you can get: `No "GlobalWorkerOptions.workerSrc" specified.`
// We set it once at module init.
GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

export const toolRead: AgentTool = {
  name: "read",
  description:
    "Fetch and read a resource by its URI. It could be a URL of a website or an internal file in the workspace. If you need to read a local file in the chat, referece it as a `file:document.md` and if in the workspace assets: `file:///assets/document.md`.",
  parameters: {
    type: "object",
    properties: {
      uri: { type: "string", description: "The URI should start with the scheme (http, https, sila, etc.)" }
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
        const { uri } = args;

        const scheme = uri.split("://")[0];
        if (!scheme) {
          throw new Error("Invalid URI, needs to start with a scheme, such as https://");
        }

        const res = await fetchImpl(uri);
        if (!res.ok) {
          throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
        }
        const contentType = res.headers.get("content-type") || "";
        
        // Only allow text-like content types
        if (contentType.includes("application/pdf")) {
          const buffer = await res.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          return await extractPdfText(bytes);
        }

        if (contentType && !isTextLikeMime(contentType)) {
          throw new Error(
            `Cannot read binary file. The read tool only supports text files (got content-type: ${contentType}). Use the look tool for images.`
          );
        }

        if (contentType.startsWith("text/plain")) {
          return await res.text();
        }

        const html = await res.text();

        const doc = new DOMParser().parseFromString(html, "text/html");
        const defuddle = new Defuddle(doc, { url: uri, separateMarkdown: true });
        const parsed = defuddle.parse();
        return parsed.contentMarkdown || parsed.content || "";
      }
    };
  }
};

async function extractPdfText(bytes: Uint8Array): Promise<string> {
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
