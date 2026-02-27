import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { ensureFileParent, normalizePath } from "./file-utils.js";

const TEXT_TO_IMAGE_MODEL_ID = "fal-ai/nano-banana-pro";
const IMAGE_TO_IMAGE_MODEL_ID = "fal-ai/nano-banana-pro/edit";
const MAX_IMAGES = 4;

const IMAGE_MIME_BY_EXTENSION = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".heic": "image/heic",
};

const EXTENSION_BY_IMAGE_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/avif": "avif",
  "image/heic": "heic",
};

function readFalApiKeyFromEnvironment() {
  if (typeof process.env.FAL_AI_API_KEY !== "string") {
    return null;
  }
  const trimmed = process.env.FAL_AI_API_KEY.trim();
  return trimmed.length ? trimmed : null;
}

function toCleanString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function clampImageCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(MAX_IMAGES, Math.max(1, Math.trunc(parsed)));
}

function detectImageMime(bytes, filePath = "") {
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

  const extension = path.extname(filePath).toLowerCase();
  if (IMAGE_MIME_BY_EXTENSION[extension]) {
    return IMAGE_MIME_BY_EXTENSION[extension];
  }

  const preview = bytes.slice(0, 512).toString("utf8").trim().toLowerCase();
  if (preview.startsWith("<svg") || preview.includes("<svg ")) {
    return "image/svg+xml";
  }

  return "";
}

function parseDataUrl(input) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(String(input || ""));
  if (!match) {
    return null;
  }

  const mimeType = (match[1] || "application/octet-stream").toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";

  try {
    const bytes = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { bytes, mimeType };
  } catch {
    return null;
  }
}

async function readLocalImageAsDataUrl(filePath, baseDir) {
  const fullPath = normalizePath(filePath, baseDir);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const stats = await fs.promises.stat(fullPath);
  if (!stats.isFile()) {
    throw new Error(`Input path is not a file: ${filePath}`);
  }

  const bytes = await fs.promises.readFile(fullPath);
  const mimeType = detectImageMime(bytes, fullPath);
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Input file is not an image: ${filePath}`);
  }

  return {
    fullPath,
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
  };
}

async function loadImageBinary(source, fetchImpl) {
  const dataUrl = parseDataUrl(source);
  if (dataUrl) {
    return {
      bytes: dataUrl.bytes,
      mimeType: dataUrl.mimeType,
      source,
    };
  }

  if (typeof source !== "string" || !/^https?:\/\//i.test(source)) {
    throw new Error("Generated image URL must be a data URL or an http(s) URL.");
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available to download generated image.");
  }

  const response = await fetchImpl(source);
  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const mimeType = contentType || detectImageMime(bytes, source) || "image/png";

  return {
    bytes,
    mimeType,
    source,
  };
}

function inferExtension(source, mimeType, fallback = "png") {
  if (mimeType && EXTENSION_BY_IMAGE_MIME[mimeType]) {
    return EXTENSION_BY_IMAGE_MIME[mimeType];
  }

  if (typeof source === "string") {
    const withoutQuery = source.split("?")[0].split("#")[0];
    const ext = path.extname(withoutQuery).replace(/^\./, "").toLowerCase();
    if (ext) {
      return ext;
    }
  }

  const cleanFallback = String(fallback || "").replace(/^\./, "").toLowerCase();
  return cleanFallback || "png";
}

function hasPathExtension(filePath) {
  return path.extname(filePath).length > 0;
}

function resolveOutputPath({ outputPath, baseDir, index, total, extension }) {
  const fallbackName = `generated-image-${Date.now()}${total > 1 ? `-${index + 1}` : ""}.${extension}`;
  if (!outputPath) {
    return path.join(baseDir, fallbackName);
  }

  const resolved = normalizePath(outputPath, baseDir);
  if (total === 1) {
    return hasPathExtension(resolved) ? resolved : `${resolved}.${extension}`;
  }

  const parsed = path.parse(resolved);
  const baseName = parsed.name || "generated-image";
  const ext = parsed.ext ? parsed.ext.replace(/^\./, "") : extension;
  return path.join(parsed.dir, `${baseName}-${index + 1}.${ext}`);
}

function toAllowedAspectRatio(value) {
  const normalized = toCleanString(value);
  if (!normalized) {
    return undefined;
  }

  const allowed = new Set([
    "auto",
    "21:9",
    "16:9",
    "3:2",
    "4:3",
    "5:4",
    "1:1",
    "4:5",
    "3:4",
    "2:3",
    "9:16",
  ]);
  if (!allowed.has(normalized)) {
    return undefined;
  }
  return normalized;
}

function toAllowedResolution(value) {
  const normalized = toCleanString(value).toUpperCase();
  if (normalized === "1K" || normalized === "2K" || normalized === "4K") {
    return normalized;
  }
  return undefined;
}

function toAllowedOutputFormat(value) {
  const normalized = toCleanString(value).toLowerCase();
  if (normalized === "jpeg" || normalized === "png" || normalized === "webp") {
    return normalized;
  }
  return undefined;
}

function formatFalError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details = error;
  if (Array.isArray(details?.body?.detail)) {
    const validationErrors = details.body.detail
      .map((entry) => {
        const location = Array.isArray(entry?.loc) ? entry.loc.join(".") : "input";
        const message = typeof entry?.msg === "string" ? entry.msg : JSON.stringify(entry);
        return `${location}: ${message}`;
      })
      .filter(Boolean)
      .join(", ");
    if (validationErrors) {
      return `Fal.ai validation error: ${validationErrors}`;
    }
  }

  return error.message;
}

function extractGeneratedImageUrls(result) {
  const images = Array.isArray(result?.data?.images) ? result.data.images : [];
  return images
    .map((item) => (typeof item?.url === "string" ? item.url.trim() : ""))
    .filter((url) => url.length > 0);
}

export function createToolGenerateImage(options = {}) {
  const {
    baseDir = process.cwd(),
    falClient = fal,
    fetchImpl = globalThis.fetch,
  } = options;

  return {
    name: "generate_image",
    description:
      "Generate or edit images with Fal.ai using a prompt and optional local input images. Returns local file paths to generated images.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Prompt describing the image to generate or edit.",
        },
        input_files: {
          type: "array",
          items: { type: "string" },
          description: "Optional local image file paths used as edit inputs.",
        },
        output_path: {
          type: "string",
          description:
            "Optional output file path. For multiple images, this path is treated as a base and numbered suffixes are added.",
        },
        num_images: {
          type: "number",
          description: `Number of images to generate (1-${MAX_IMAGES}).`,
          default: 1,
        },
        aspect_ratio: {
          type: "string",
          description: "Optional aspect ratio (for example 1:1, 16:9, 9:16, auto).",
        },
        output_format: {
          type: "string",
          enum: ["jpeg", "png", "webp"],
          description: "Output image format.",
          default: "png",
        },
        resolution: {
          type: "string",
          enum: ["1K", "2K", "4K"],
          description: "Image resolution.",
          default: "1K",
        },
        sync_mode: {
          type: "boolean",
          description: "Fal sync mode.",
          default: false,
        },
      },
      required: ["prompt"],
    },
    handler: async ({
      prompt,
      input_files,
      output_path,
      num_images,
      aspect_ratio,
      output_format,
      resolution,
      sync_mode,
    }) => {
      const cleanPrompt = toCleanString(prompt);
      if (!cleanPrompt) {
        return {
          status: "failed",
          message: "Invalid prompt: must be a non-empty string.",
        };
      }

      const apiKey = readFalApiKeyFromEnvironment();
      if (!apiKey) {
        return {
          status: "failed",
          message: "FAL_AI_API_KEY is not configured. Set it in land .env or process env.",
        };
      }

      const inputFiles = Array.isArray(input_files)
        ? input_files.filter((item) => typeof item === "string" && item.trim().length > 0)
        : [];

      try {
        const inputImages = [];
        for (const inputFilePath of inputFiles) {
          inputImages.push(await readLocalImageAsDataUrl(inputFilePath, baseDir));
        }

        const imageUrls = inputImages.map((image) => image.dataUrl);
        const hasInputImages = imageUrls.length > 0;
        const modelId = hasInputImages ? IMAGE_TO_IMAGE_MODEL_ID : TEXT_TO_IMAGE_MODEL_ID;

        const normalizedOutputFormat = toAllowedOutputFormat(output_format) || "png";
        const normalizedResolution = toAllowedResolution(resolution) || "1K";
        const normalizedAspectRatio =
          toAllowedAspectRatio(aspect_ratio) ||
          (hasInputImages ? "auto" : "1:1");

        const input = {
          prompt: cleanPrompt,
          num_images: clampImageCount(num_images),
          output_format: normalizedOutputFormat,
          resolution: normalizedResolution,
          sync_mode: typeof sync_mode === "boolean" ? sync_mode : false,
          aspect_ratio: normalizedAspectRatio,
        };

        if (hasInputImages) {
          input.image_urls = imageUrls;
        }

        falClient.config({ credentials: apiKey });
        const result = await falClient.subscribe(modelId, {
          input,
          logs: true,
        });

        const generatedUrls = extractGeneratedImageUrls(result);
        if (!generatedUrls.length) {
          return {
            status: "failed",
            message: "No images were generated.",
          };
        }

        const savedPaths = [];
        for (let index = 0; index < generatedUrls.length; index += 1) {
          const sourceUrl = generatedUrls[index];
          const binary = await loadImageBinary(sourceUrl, fetchImpl);
          const extension = inferExtension(sourceUrl, binary.mimeType, normalizedOutputFormat);
          const fullPath = resolveOutputPath({
            outputPath: output_path,
            baseDir,
            index,
            total: generatedUrls.length,
            extension,
          });

          await ensureFileParent(fullPath);
          await fs.promises.writeFile(fullPath, binary.bytes);
          savedPaths.push(fullPath);
        }

        return {
          status: "completed",
          message: `Generated ${savedPaths.length} image${savedPaths.length === 1 ? "" : "s"}.`,
          files: savedPaths,
        };
      } catch (error) {
        return {
          status: "failed",
          message: `Failed to generate image: ${formatFalError(error)}`,
        };
      }
    },
  };
}
