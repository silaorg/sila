import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { ensureFileParent, normalizePath } from "./file-utils.js";

const IMAGE_TO_VIDEO_MODEL_ID = "fal-ai/veo3/image-to-video";

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

const EXTENSION_BY_VIDEO_MIME = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/ogg": "ogv",
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
  return IMAGE_MIME_BY_EXTENSION[extension] || "";
}

async function readLocalImage(filePath, baseDir) {
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
    bytes,
    mimeType,
  };
}

function durationToVeo3Value(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (parsed <= 4) {
    return "4s";
  }
  if (parsed <= 6) {
    return "6s";
  }
  return "8s";
}

function normalizeAspectRatio(value) {
  const normalized = toCleanString(value);
  if (!normalized) {
    return undefined;
  }
  const allowed = new Set(["auto", "16:9", "9:16", "1:1"]);
  return allowed.has(normalized) ? normalized : undefined;
}

function normalizeResolution(value) {
  const normalized = toCleanString(value).toLowerCase();
  if (normalized === "720p" || normalized === "1080p") {
    return normalized;
  }
  return undefined;
}

function extractVideoUrl(result) {
  const singleVideoUrl = typeof result?.data?.video?.url === "string"
    ? result.data.video.url.trim()
    : "";
  if (singleVideoUrl) {
    return singleVideoUrl;
  }

  const videos = Array.isArray(result?.data?.videos) ? result.data.videos : [];
  for (const entry of videos) {
    if (typeof entry?.url === "string" && entry.url.trim().length > 0) {
      return entry.url.trim();
    }
  }
  return "";
}

async function downloadVideo(videoUrl, fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available to download generated video.");
  }

  const response = await fetchImpl(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated video: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();

  return {
    bytes,
    contentType,
  };
}

function inferVideoExtension(videoUrl, contentType) {
  if (contentType && EXTENSION_BY_VIDEO_MIME[contentType]) {
    return EXTENSION_BY_VIDEO_MIME[contentType];
  }

  if (typeof videoUrl === "string") {
    const withoutQuery = videoUrl.split("?")[0].split("#")[0];
    const ext = path.extname(withoutQuery).replace(/^\./, "").toLowerCase();
    if (ext) {
      return ext;
    }
  }

  return "mp4";
}

function withExtensionIfMissing(targetPath, extension) {
  if (path.extname(targetPath)) {
    return targetPath;
  }
  return `${targetPath}.${extension}`;
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

function resolveUploadedUrl(uploadResult) {
  if (typeof uploadResult === "string" && uploadResult.trim().length > 0) {
    return uploadResult.trim();
  }
  if (uploadResult && typeof uploadResult === "object" && typeof uploadResult.url === "string") {
    const trimmed = uploadResult.url.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
}

export function createToolGenerateVideo(options = {}) {
  const {
    baseDir = process.cwd(),
    falClient = fal,
    fetchImpl = globalThis.fetch,
  } = options;

  return {
    name: "generate_video",
    description:
      "Generate a video from a local image file using Fal.ai. Returns the local output file path.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Prompt describing desired animation or motion.",
        },
        input_file: {
          type: "string",
          description: "Path to the local input image file.",
        },
        output_path: {
          type: "string",
          description: "Optional output file path for the generated video.",
        },
        duration: {
          type: "number",
          description: "Requested duration in seconds. Normalized to 4s, 6s, or 8s for Veo3.",
        },
        aspect_ratio: {
          type: "string",
          enum: ["auto", "16:9", "9:16", "1:1"],
          description: "Aspect ratio of the generated video.",
        },
        resolution: {
          type: "string",
          enum: ["720p", "1080p"],
          description: "Video resolution.",
        },
        generate_audio: {
          type: "boolean",
          description: "Whether generated video should include audio.",
        },
      },
      required: ["prompt", "input_file"],
    },
    handler: async ({
      prompt,
      input_file,
      output_path,
      duration,
      aspect_ratio,
      resolution,
      generate_audio,
    }) => {
      const cleanPrompt = toCleanString(prompt);
      if (!cleanPrompt) {
        return {
          status: "failed",
          message: "Invalid prompt: must be a non-empty string.",
        };
      }

      const cleanInputFile = toCleanString(input_file);
      if (!cleanInputFile) {
        return {
          status: "failed",
          message: "Invalid input_file: must be a non-empty string.",
        };
      }

      const apiKey = readFalApiKeyFromEnvironment();
      if (!apiKey) {
        return {
          status: "failed",
          message: "FAL_AI_API_KEY is not configured. Set it in land .env or process env.",
        };
      }

      try {
        const inputImage = await readLocalImage(cleanInputFile, baseDir);

        falClient.config({ credentials: apiKey });

        const storage = falClient?.storage;
        if (!storage || typeof storage.upload !== "function") {
          throw new Error("Fal.ai storage.upload is unavailable.");
        }

        const uploadResult = await storage.upload(new Blob([inputImage.bytes], { type: inputImage.mimeType }));
        const imageUrl = resolveUploadedUrl(uploadResult);
        if (!imageUrl) {
          throw new Error("Failed to upload input image to Fal.ai storage.");
        }

        const input = {
          prompt: cleanPrompt,
          image_url: imageUrl,
        };

        const veo3Duration = durationToVeo3Value(duration);
        if (veo3Duration) {
          input.duration = veo3Duration;
        }

        const normalizedAspectRatio = normalizeAspectRatio(aspect_ratio);
        if (normalizedAspectRatio) {
          input.aspect_ratio = normalizedAspectRatio;
        }

        const normalizedResolution = normalizeResolution(resolution);
        if (normalizedResolution) {
          input.resolution = normalizedResolution;
        }

        if (typeof generate_audio === "boolean") {
          input.generate_audio = generate_audio;
        }

        const result = await falClient.subscribe(IMAGE_TO_VIDEO_MODEL_ID, {
          input,
          logs: true,
        });

        const videoUrl = extractVideoUrl(result);
        if (!videoUrl) {
          return {
            status: "failed",
            message: "No video URL returned by Fal.ai.",
          };
        }

        const downloaded = await downloadVideo(videoUrl, fetchImpl);
        const extension = inferVideoExtension(videoUrl, downloaded.contentType);

        const rawOutputPath = output_path
          ? normalizePath(output_path, baseDir)
          : path.join(baseDir, `generated-video-${Date.now()}.${extension}`);
        const finalOutputPath = withExtensionIfMissing(rawOutputPath, extension);

        await ensureFileParent(finalOutputPath);
        await fs.promises.writeFile(finalOutputPath, downloaded.bytes);

        return {
          status: "completed",
          message: "Generated video.",
          files: [finalOutputPath],
        };
      } catch (error) {
        return {
          status: "failed",
          message: `Failed to generate video: ${formatFalError(error)}`,
        };
      }
    },
  };
}
