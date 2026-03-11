import fs from "node:fs";
import path from "node:path";
import { ChatAgent, LangMessage, LangMessages } from "aiwrapper";
import { normalizePath } from "./file-utils.js";

const DEFAULT_PROMPT = "Describe the visible content of this image.";

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function mimeFromExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".bmp") return "image/bmp";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".avif") return "image/avif";
  if (extension === ".heic") return "image/heic";
  return "";
}

function detectImageMime(bytes, contentType = "", filePath = "") {
  const fromHeader = String(contentType).split(";")[0].trim().toLowerCase();
  if (fromHeader.startsWith("image/")) {
    return fromHeader;
  }

  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (bytes.length >= 6) {
    const gifHeader = String.fromCharCode(...bytes.slice(0, 6));
    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
      return "image/gif";
    }
  }

  if (bytes.length >= 12) {
    const riffHeader = String.fromCharCode(...bytes.slice(0, 4));
    const webpHeader = String.fromCharCode(...bytes.slice(8, 12));
    if (riffHeader === "RIFF" && webpHeader === "WEBP") {
      return "image/webp";
    }
  }

  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }

  const fallback = mimeFromExtension(filePath);
  if (fallback) {
    return fallback;
  }

  const preview = bytes.slice(0, 512).toString("utf8").trim().toLowerCase();
  if (preview.startsWith("<svg") || preview.includes("<svg ")) {
    return "image/svg+xml";
  }

  return "";
}

function buildSeeInstructions() {
  return [
    "You are a vision assistant.",
    "Describe visible image content succinctly and accurately.",
    "Do not infer details that are not visible.",
  ].join("\n");
}

async function loadImageFromUrl(uri) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to fetch image URL: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get("content-type") || "");
  const mimeType = detectImageMime(bytes, contentType);
  if (!mimeType) {
    throw new Error("URL content does not appear to be an image.");
  }

  return {
    source: uri,
    mimeType,
    base64: bytes.toString("base64"),
  };
}

async function loadImageFromFile(uri, baseDir) {
  const fullPath = normalizePath(uri, baseDir);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${uri}`);
  }

  const bytes = await fs.promises.readFile(fullPath);
  const mimeType = detectImageMime(bytes, "", fullPath);
  if (!mimeType) {
    throw new Error(`File does not appear to be an image: ${uri}`);
  }

  return {
    source: fullPath,
    mimeType,
    base64: bytes.toString("base64"),
  };
}

async function runVisionAgent(lang, prompt, image) {
  if (!lang || typeof lang.chat !== "function") {
    throw new Error("Language provider with image support is not available.");
  }

  const agent = new ChatAgent(lang);
  const messages = new LangMessages([
    new LangMessage("user", [
      { type: "text", text: prompt },
      {
        type: "image",
        base64: image.base64,
        mimeType: image.mimeType,
        metadata: { source: image.source },
      },
    ]),
  ]);
  messages.instructions = buildSeeInstructions();

  const result = await agent.run(messages);
  const assistant = [...result].reverse().find((message) => message.role === "assistant");
  return assistant?.text?.trim() || "";
}

function createToolImageVision(options = {}) {
  const {
    lang,
    baseDir = process.cwd(),
    name = "see",
  } = options;

  return {
    name,
    description:
      "Inspect an image from a URL or local file path and return a concise visual description.",
    parameters: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "Image location. Supports http(s), file: URIs, and local paths.",
        },
        prompt: {
          type: "string",
          description: "What to focus on in the image.",
          default: DEFAULT_PROMPT,
        },
      },
      required: ["uri"],
    },
    handler: async ({ uri, prompt = DEFAULT_PROMPT }) => {
      try {
        if (typeof uri !== "string" || uri.trim().length === 0) {
          return { error: "`uri` must be a non-empty string." };
        }

        const cleanUri = uri.trim();
        const cleanPrompt = typeof prompt === "string" && prompt.trim().length > 0
          ? prompt.trim()
          : DEFAULT_PROMPT;

        const image = isHttpUrl(cleanUri)
          ? await loadImageFromUrl(cleanUri)
          : await loadImageFromFile(cleanUri, baseDir);

        const description = await runVisionAgent(lang, cleanPrompt, image);
        return {
          uri: image.source,
          mimeType: image.mimeType,
          description: description || "No description was generated.",
        };
      } catch (error) {
        return { error: `Error seeing image: ${error.message}` };
      }
    },
  };
}

export function createToolSeeImage(options = {}) {
  return createToolImageVision({ ...options, name: "see" });
}
