import fs from "node:fs/promises";
import path from "node:path";
import { AppWorkspaceError } from "./app-workspace-error.js";

export const MAX_APP_FILE_COUNT = 8;
export const MAX_APP_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_APP_UPLOAD_BYTES = 40 * 1024 * 1024;

const MAX_LISTED_FILES = 50;
const MAX_SCANNED_FILES = 2_000;
const MAX_SCAN_DEPTH = 12;
const FILE_REFERENCE_PATTERN = /^(workspace|thread):(.+)$/;

export class AppFileStore {
  #workspacePath;

  constructor(workspacePath) {
    this.#workspacePath = path.resolve(workspacePath);
  }

  async list(threadDir, query = "") {
    const normalizedQuery = String(query ?? "").trim().toLowerCase();
    const roots = [
      {
        scope: "workspace",
        root: path.join(this.#workspacePath, "assets"),
        referencePrefix: "assets",
      },
      {
        scope: "thread",
        root: path.join(threadDir, "files"),
        referencePrefix: "files",
      },
    ];
    const files = [];
    let scanned = 0;

    for (const root of roots) {
      const entries = await walkFiles(root.root, {
        maxDepth: MAX_SCAN_DEPTH,
        maxFiles: Math.max(0, MAX_SCANNED_FILES - scanned),
      });
      scanned += entries.length;
      for (const entry of entries) {
        const relativePath = toPosixPath(path.relative(root.root, entry.path));
        const displayPath = `${root.referencePrefix}/${relativePath}`;
        if (
          normalizedQuery
          && !entry.name.toLowerCase().includes(normalizedQuery)
          && !displayPath.toLowerCase().includes(normalizedQuery)
        ) {
          continue;
        }
        files.push(toPublicFile({
          scope: root.scope,
          reference: `${root.scope}:${displayPath}`,
          relativePath: displayPath,
          name: entry.name,
          size: entry.size,
        }));
      }
    }

    return files
      .sort((left, right) => {
        const nameOrder = left.name.localeCompare(right.name);
        return nameOrder || left.path.localeCompare(right.path);
      })
      .slice(0, MAX_LISTED_FILES);
  }

  async upload(threadDir, inputFiles, createdAt = new Date()) {
    const files = normalizeUploadFiles(inputFiles);
    const datePath = buildDatePath(createdAt);
    const destinationDir = path.join(threadDir, "files", datePath);
    await fs.mkdir(destinationDir, { recursive: true });

    const stored = [];
    try {
      for (const file of files) {
        const targetPath = await writeUniqueFile(
          destinationDir,
          sanitizeFileName(file.name),
          file.data,
        );
        const relativePath = toPosixPath(path.relative(threadDir, targetPath));
        stored.push({
          ...toPublicFile({
            scope: "thread",
            reference: `thread:${relativePath}`,
            relativePath,
            name: path.basename(targetPath),
            size: file.data.byteLength,
            mimeType: normalizeMimeType(targetPath),
          }),
          absolutePath: targetPath,
        });
      }
    } catch (error) {
      await Promise.allSettled(stored.map((file) => fs.unlink(file.absolutePath)));
      throw error;
    }

    return stored.map(({ absolutePath: _absolutePath, ...file }) => file);
  }

  async resolve(threadDir, reference) {
    const parsed = parseFileReference(reference);
    const container = parsed.scope === "workspace" ? this.#workspacePath : threadDir;
    const root = parsed.scope === "workspace"
      ? path.join(container, "assets")
      : path.join(container, "files");
    const expectedPrefix = parsed.scope === "workspace" ? "assets/" : "files/";
    if (!parsed.relativePath.startsWith(expectedPrefix)) {
      throw invalidFileReference();
    }

    const pathWithinRoot = parsed.relativePath.slice(expectedPrefix.length);
    const absolutePath = resolveWithin(root, pathWithinRoot);
    let stats;
    try {
      stats = await fs.lstat(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new AppWorkspaceError("not_found", "File not found.", { cause: error });
      }
      throw error;
    }
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new AppWorkspaceError("not_found", "File not found.");
    }
    await requireCanonicalPathWithin(container, root, absolutePath);

    return {
      ...toPublicFile({
        scope: parsed.scope,
        reference: parsed.reference,
        relativePath: parsed.relativePath,
        name: path.basename(absolutePath),
        size: stats.size,
      }),
      absolutePath,
      agentPath: toPosixPath(path.relative(threadDir, absolutePath)),
    };
  }

  async removeThreadFile(threadDir, reference) {
    const file = await this.resolve(threadDir, reference);
    if (file.scope !== "thread") {
      throw new AppWorkspaceError(
        "invalid_input",
        "Only thread uploads can be removed here.",
      );
    }
    await fs.unlink(file.absolutePath);
  }
}

function normalizeUploadFiles(inputFiles) {
  if (!Array.isArray(inputFiles) || inputFiles.length === 0) {
    throw new AppWorkspaceError("invalid_input", "Choose at least one file.");
  }
  if (inputFiles.length > MAX_APP_FILE_COUNT) {
    throw new AppWorkspaceError(
      "invalid_input",
      `You can attach up to ${MAX_APP_FILE_COUNT} files at once.`,
    );
  }

  let totalBytes = 0;
  return inputFiles.map((file) => {
    const data = file?.data instanceof Uint8Array
      ? file.data
      : file?.data instanceof ArrayBuffer
        ? new Uint8Array(file.data)
        : null;
    if (!data) {
      throw new AppWorkspaceError("invalid_input", "Invalid uploaded file.");
    }
    if (data.byteLength > MAX_APP_FILE_BYTES) {
      throw new AppWorkspaceError(
        "invalid_input",
        `"${sanitizeFileName(file.name)}" is larger than 20 MB.`,
      );
    }
    totalBytes += data.byteLength;
    if (totalBytes > MAX_APP_UPLOAD_BYTES) {
      throw new AppWorkspaceError(
        "invalid_input",
        "The combined upload is larger than 40 MB.",
      );
    }
    return {
      name: file.name,
      data,
    };
  });
}

function parseFileReference(value) {
  const reference = typeof value === "string" ? value.trim() : "";
  const match = FILE_REFERENCE_PATTERN.exec(reference);
  if (!match) {
    throw invalidFileReference();
  }
  const relativePath = toPosixPath(match[2]);
  if (
    !relativePath
    || relativePath.startsWith("/")
    || relativePath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw invalidFileReference();
  }
  return {
    scope: match[1],
    reference: `${match[1]}:${relativePath}`,
    relativePath,
  };
}

function invalidFileReference() {
  return new AppWorkspaceError("invalid_input", "Invalid file reference.");
}

function resolveWithin(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved === resolvedRoot || !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw invalidFileReference();
  }
  return resolved;
}

async function walkFiles(root, options, relativeDir = "", depth = 0, output = []) {
  if (depth > options.maxDepth || output.length >= options.maxFiles) {
    return output;
  }
  if (depth === 0) {
    try {
      const rootStats = await fs.lstat(root);
      if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) return output;
    } catch (error) {
      if (error?.code === "ENOENT") return output;
      throw error;
    }
  }
  let entries;
  try {
    entries = await fs.readdir(path.join(root, relativeDir), { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return output;
    throw error;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (output.length >= options.maxFiles) break;
    if (entry.isSymbolicLink()) continue;
    const entryRelativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(root, options, entryRelativePath, depth + 1, output);
    } else if (entry.isFile()) {
      const absolutePath = path.join(root, entryRelativePath);
      const stats = await fs.stat(absolutePath);
      output.push({ path: absolutePath, name: entry.name, size: stats.size });
    }
  }
  return output;
}

async function writeUniqueFile(directory, fileName, data) {
  const parsed = path.parse(fileName);
  for (let index = 0; index < 10_000; index += 1) {
    const suffix = index === 0 ? "" : `_${index}`;
    const candidate = path.join(
      directory,
      `${parsed.name || "file"}${suffix}${parsed.ext}`,
    );
    let handle;
    try {
      handle = await fs.open(candidate, "wx");
      await handle.writeFile(data);
      await handle.close();
      return candidate;
    } catch (error) {
      await handle?.close().catch(() => {});
      if (error?.code === "EEXIST") continue;
      await fs.unlink(candidate).catch(() => {});
      throw error;
    }
  }
  throw new Error(`Could not choose a unique filename for ${fileName}.`);
}

function sanitizeFileName(value) {
  const normalized = String(value ?? "").trim();
  const safe = normalized
    .replace(/[/\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/^[ ._]+/, "")
    .slice(0, 180);
  return safe && safe !== "." && safe !== ".." ? safe : `file_${Date.now()}`;
}

function buildDatePath(date) {
  return [
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join(path.sep);
}

function toPublicFile(input) {
  const mimeType = input.mimeType ?? normalizeMimeType(input.name);
  return {
    reference: input.reference,
    scope: input.scope,
    path: input.relativePath,
    name: input.name,
    size: input.size,
    mimeType,
    kind: getFileKind(mimeType),
  };
}

function normalizeMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

function getFileKind(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("text/") || mimeType === "application/json") return "text";
  return "file";
}

function toPosixPath(value) {
  return String(value).split(path.sep).join("/").replaceAll("\\", "/");
}

async function requireCanonicalPathWithin(container, root, filePath) {
  const [canonicalContainer, canonicalRoot, canonicalFile] = await Promise.all([
    fs.realpath(container),
    fs.realpath(root),
    fs.realpath(filePath),
  ]);
  if (
    !isPathWithin(canonicalContainer, canonicalRoot)
    || !isPathWithin(canonicalRoot, canonicalFile)
  ) {
    throw invalidFileReference();
  }
}

function isPathWithin(root, candidate) {
  return candidate !== root && candidate.startsWith(`${root}${path.sep}`);
}

const MIME_TYPES = Object.freeze({
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".tsv": "text/tab-separated-values",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
});
