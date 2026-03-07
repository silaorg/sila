import fs from "node:fs/promises";
import path from "node:path";
import { File } from "node:buffer";
import { fal } from "@fal-ai/client";

const ENDPOINT_PATTERN = /^fal-ai\/[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/i;
const MAX_UPLOAD_FILES = 8;
const MAX_UPLOAD_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_DOWNLOAD_FILES = 8;
const MAX_DOWNLOAD_TOTAL_BYTES = 250 * 1024 * 1024;

const MIME_BY_EXTENSION = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".txt": "text/plain",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

const EXTENSION_BY_MIME = {
  "application/json": "json",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDotEnv(raw) {
  const out = {};
  const lines = String(raw).split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equals = line.indexOf("=");
    if (equals <= 0) {
      continue;
    }

    const key = line.slice(0, equals).trim();
    if (!key) {
      continue;
    }

    const valueRaw = line.slice(equals + 1).trim();
    out[key] = parseDotEnvValue(valueRaw);
  }

  return out;
}

function parseDotEnvValue(valueRaw) {
  if (valueRaw.startsWith("\"") && valueRaw.endsWith("\"") && valueRaw.length >= 2) {
    return valueRaw.slice(1, -1).replace(/\\n/g, "\n");
  }
  if (valueRaw.startsWith("'") && valueRaw.endsWith("'") && valueRaw.length >= 2) {
    return valueRaw.slice(1, -1);
  }

  const hashIndex = valueRaw.indexOf(" #");
  if (hashIndex >= 0) {
    return valueRaw.slice(0, hashIndex).trim();
  }

  return valueRaw;
}

async function readFalApiKeyFromLandEnv(landPath) {
  if (!landPath) {
    return "";
  }

  try {
    const raw = await fs.readFile(path.join(landPath, ".env"), "utf8");
    const parsed = parseDotEnv(raw);
    const candidates = [parsed.FAL_AI_API_KEY, parsed.FAL_KEY];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }

  return "";
}

async function readFalApiKey(landPath) {
  const candidates = [process.env.FAL_AI_API_KEY, process.env.FAL_KEY];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return readFalApiKeyFromLandEnv(landPath);
}

function normalizePath(filePath, baseDir) {
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(baseDir, filePath);
}

async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function toUploadLifecycle(storageLifecycle) {
  return storageLifecycle ? { expiresIn: storageLifecycle } : undefined;
}

function cloneInput(input) {
  if (typeof structuredClone === "function") {
    return structuredClone(input);
  }
  return JSON.parse(JSON.stringify(input));
}

function parseJsonPath(rawPath) {
  const normalized = String(rawPath || "").trim().replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").filter(Boolean).map((segment) => {
    return /^\d+$/.test(segment) ? Number(segment) : segment;
  });

  if (!segments.length) {
    throw new Error(`Invalid JSON path: ${rawPath}`);
  }

  return segments;
}

function setAtPath(root, rawPath, value) {
  const segments = parseJsonPath(rawPath);
  let current = root;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    const nextValue = current[segment];

    if (nextValue === undefined) {
      current[segment] = typeof nextSegment === "number" ? [] : {};
    } else if (typeof nextSegment === "number" && !Array.isArray(nextValue)) {
      throw new Error(`Path "${rawPath}" expects an array at "${String(segment)}".`);
    } else if (typeof nextSegment !== "number" && !isPlainObject(nextValue)) {
      throw new Error(`Path "${rawPath}" expects an object at "${String(segment)}".`);
    }

    current = current[segment];
  }

  current[segments[segments.length - 1]] = value;
}

function getAtPath(root, rawPath) {
  const segments = parseJsonPath(rawPath);
  let current = root;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function isUrlLike(value) {
  return typeof value === "string" && /^(https?:\/\/|data:)/i.test(value.trim());
}

function collectUrlsFromValue(value, accumulator) {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    if (isUrlLike(value)) {
      accumulator.push(value.trim());
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectUrlsFromValue(entry, accumulator);
    }
    return;
  }

  if (isPlainObject(value)) {
    if (isUrlLike(value.url)) {
      accumulator.push(value.url.trim());
      return;
    }

    for (const nestedValue of Object.values(value)) {
      collectUrlsFromValue(nestedValue, accumulator);
    }
  }
}

function dedupeLimitUrls(urls) {
  const seen = new Set();
  const unique = [];

  for (const url of urls) {
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    unique.push(url);
    if (unique.length >= MAX_DOWNLOAD_FILES) {
      break;
    }
  }

  return unique;
}

function detectOutputUrls(result, outputPaths) {
  const candidates = [];
  const scopes = [];

  if (isPlainObject(result?.data) || Array.isArray(result?.data)) {
    scopes.push(result.data);
  }
  scopes.push(result);

  if (Array.isArray(outputPaths) && outputPaths.length) {
    for (const rawPath of outputPaths) {
      for (const scope of scopes) {
        collectUrlsFromValue(getAtPath(scope, rawPath), candidates);
      }
    }
    return dedupeLimitUrls(candidates);
  }

  for (const scope of scopes) {
    collectUrlsFromValue(scope, candidates);
    if (candidates.length) {
      break;
    }
  }

  return dedupeLimitUrls(candidates);
}

function detectMimeTypeFromPath(filePath) {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function detectDataUrl(input) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(String(input || ""));
  if (!match) {
    return null;
  }

  const mimeType = (match[1] || "application/octet-stream").toLowerCase();
  const payload = match[3] || "";
  try {
    const bytes = match[2]
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { bytes, mimeType };
  } catch {
    return null;
  }
}

async function readUploadFile(uploadFile, baseDir) {
  if (!isPlainObject(uploadFile)) {
    throw new Error("Each upload_files item must be an object.");
  }

  const relativePath = String(uploadFile.path || "").trim();
  const inputPath = String(uploadFile.input_path || "").trim();
  const explicitContentType = String(uploadFile.content_type || "").trim().toLowerCase();

  if (!relativePath) {
    throw new Error("upload_files.path is required.");
  }
  if (!inputPath) {
    throw new Error(`upload_files.input_path is required for "${relativePath}".`);
  }

  const fullPath = normalizePath(relativePath, baseDir);
  const stat = await fs.stat(fullPath);

  if (!stat.isFile()) {
    throw new Error(`Upload path is not a file: ${relativePath}`);
  }
  if (stat.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new Error(`Upload file exceeds ${MAX_UPLOAD_FILE_SIZE_BYTES} bytes: ${relativePath}`);
  }

  const bytes = await fs.readFile(fullPath);
  const contentType = explicitContentType || detectMimeTypeFromPath(fullPath);
  const file = new File([bytes], path.basename(fullPath), { type: contentType });
  return {
    file,
    fullPath,
    inputPath,
  };
}

async function downloadOutput(url, fetchImpl) {
  const dataUrl = detectDataUrl(url);
  if (dataUrl) {
    return {
      bytes: dataUrl.bytes,
      mimeType: dataUrl.mimeType,
      sourceUrl: url,
    };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable for downloading Fal outputs.");
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const mimeType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  return {
    bytes,
    mimeType: mimeType || "application/octet-stream",
    sourceUrl: url,
  };
}

function inferExtension(sourceUrl, mimeType) {
  if (mimeType && EXTENSION_BY_MIME[mimeType]) {
    return EXTENSION_BY_MIME[mimeType];
  }

  if (typeof sourceUrl === "string") {
    const ext = path.extname(sourceUrl.split("?")[0].split("#")[0]).replace(/^\./, "").toLowerCase();
    if (ext) {
      return ext;
    }
  }

  return "bin";
}

function sanitizeEndpointBase(endpoint) {
  return endpoint.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "fal-output";
}

function resolveOutputFilePath({ outputPath, baseDir, endpoint, index, total, extension }) {
  const fallbackBase = `${sanitizeEndpointBase(endpoint)}-${Date.now()}`;
  if (!outputPath) {
    return path.join(baseDir, `${fallbackBase}${total > 1 ? `-${index + 1}` : ""}.${extension}`);
  }

  const resolved = normalizePath(outputPath, baseDir);
  if (total === 1) {
    return path.extname(resolved) ? resolved : `${resolved}.${extension}`;
  }

  const parsed = path.parse(resolved);
  const baseName = parsed.name || fallbackBase;
  const finalExtension = parsed.ext ? parsed.ext.replace(/^\./, "") : extension;
  return path.join(parsed.dir, `${baseName}-${index + 1}.${finalExtension}`);
}

function formatFalError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const validationErrors = error?.body?.detail;
  if (Array.isArray(validationErrors)) {
    const details = validationErrors
      .map((entry) => {
        const location = Array.isArray(entry?.loc) ? entry.loc.join(".") : "input";
        const message = typeof entry?.msg === "string" ? entry.msg : JSON.stringify(entry);
        return `${location}: ${message}`;
      })
      .filter(Boolean)
      .join(", ");

    if (details) {
      return `Fal validation error: ${details}`;
    }
  }

  return error.message;
}

export function createTool(context = {}) {
  const baseDir = context.defaultCwd || context.threadDir || context.landPath || process.cwd();
  const fetchImpl = globalThis.fetch;
  const landPath = context.landPath || "";

  return {
    name: "fal_run",
    description: "Run a Fal model endpoint, upload local files, and save generated outputs to local files.",
    parameters: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "Fal endpoint id such as fal-ai/nano-banana-pro or fal-ai/veo3.1/image-to-video.",
        },
        input: {
          type: "object",
          description: "Exact JSON payload for the selected Fal endpoint.",
          additionalProperties: true,
        },
        upload_files: {
          type: "array",
          description: "Optional local files to upload before the call and inject into input paths.",
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Local file path relative to the thread cwd or absolute path.",
              },
              input_path: {
                type: "string",
                description: "Dot or bracket JSON path inside input, for example image_url or image_urls[0].",
              },
              content_type: {
                type: "string",
                description: "Optional MIME type override for the uploaded file.",
              },
            },
            required: ["path", "input_path"],
            additionalProperties: false,
          },
        },
        output_path: {
          type: "string",
          description: "Optional file path or extensionless base path used when saving generated outputs.",
        },
        output_paths: {
          type: "array",
          description: "Optional result.data JSON paths to URLs that should be downloaded, for example images[0].url or video.url.",
          items: {
            type: "string",
          },
        },
        storage_lifecycle: {
          type: "string",
          enum: ["1h", "1d", "7d", "30d", "1y", "never"],
          description: "Optional Fal object retention hint for uploaded files and generated outputs.",
        },
      },
      required: ["endpoint", "input"],
      additionalProperties: false,
    },
    async handler({ endpoint, input, upload_files, output_path, output_paths, storage_lifecycle }) {
      try {
        const cleanEndpoint = String(endpoint || "").trim();
        if (!ENDPOINT_PATTERN.test(cleanEndpoint)) {
          return {
            status: "failed",
            message: `Invalid Fal endpoint: ${cleanEndpoint || "<empty>"}`,
          };
        }

        if (!isPlainObject(input)) {
          return {
            status: "failed",
            message: "input must be an object.",
          };
        }

        const apiKey = await readFalApiKey(landPath);
        if (!apiKey) {
          return {
            status: "failed",
            message: "Missing FAL_AI_API_KEY or FAL_KEY in process env or land .env.",
          };
        }

        if (Array.isArray(upload_files) && upload_files.length > MAX_UPLOAD_FILES) {
          return {
            status: "failed",
            message: `upload_files supports at most ${MAX_UPLOAD_FILES} items.`,
          };
        }

        const preparedInput = cloneInput(input);
        const uploadedFiles = [];
        fal.config({ credentials: apiKey });

        for (const uploadFile of upload_files || []) {
          const upload = await readUploadFile(uploadFile, baseDir);
          const uploadedUrl = await fal.storage.upload(upload.file, {
            lifecycle: toUploadLifecycle(storage_lifecycle),
          });
          setAtPath(preparedInput, upload.inputPath, uploadedUrl);
          uploadedFiles.push({
            source_path: upload.fullPath,
            input_path: upload.inputPath,
            url: uploadedUrl,
          });
        }

        const result = await fal.subscribe(cleanEndpoint, {
          input: preparedInput,
          logs: true,
          ...(storage_lifecycle ? { storageSettings: { expiresIn: storage_lifecycle } } : {}),
        });

        const outputUrls = detectOutputUrls(result, output_paths);
        if (!outputUrls.length) {
          return {
            status: "completed",
            endpoint: cleanEndpoint,
            message: "Fal call completed but no downloadable output URLs were detected.",
            uploaded_files: uploadedFiles,
            files: [],
            result,
          };
        }

        let downloadedBytes = 0;
        const savedFiles = [];

        for (let index = 0; index < outputUrls.length; index += 1) {
          const outputUrl = outputUrls[index];
          const download = await downloadOutput(outputUrl, fetchImpl);
          downloadedBytes += download.bytes.length;
          if (downloadedBytes > MAX_DOWNLOAD_TOTAL_BYTES) {
            throw new Error(`Downloaded outputs exceed ${MAX_DOWNLOAD_TOTAL_BYTES} bytes.`);
          }

          const extension = inferExtension(outputUrl, download.mimeType);
          const filePath = resolveOutputFilePath({
            outputPath: output_path,
            baseDir,
            endpoint: cleanEndpoint,
            index,
            total: outputUrls.length,
            extension,
          });

          await ensureParentDirectory(filePath);
          await fs.writeFile(filePath, download.bytes);
          savedFiles.push(filePath);
        }

        return {
          status: "completed",
          endpoint: cleanEndpoint,
          message: `Saved ${savedFiles.length} output file${savedFiles.length === 1 ? "" : "s"}.`,
          uploaded_files: uploadedFiles,
          files: savedFiles,
          result,
        };
      } catch (error) {
        return {
          status: "failed",
          endpoint: String(endpoint || "").trim(),
          message: formatFalError(error),
        };
      }
    },
  };
}

export default createTool;
