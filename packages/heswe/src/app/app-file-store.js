import fs from "node:fs/promises";
import path from "node:path";
import { AppWorkspaceError } from "./app-workspace-error.js";

export const MAX_APP_FILE_COUNT = 8;
export const MAX_APP_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_APP_UPLOAD_BYTES = 40 * 1024 * 1024;

const MAX_LISTED_FILES = 50;
const MAX_DIRECTORY_ENTRIES = 1_000;
const MAX_MOVED_ENTRIES = 100;
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

  async browse(relativeDirectory = "") {
    const assetsRoot = await this.#requireAssetsRoot();
    const directoryPath = await requireAssetsEntry(
      assetsRoot,
      relativeDirectory,
      "directory",
      { allowRoot: true },
    );
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const visibleEntries = [];

    for (const entry of entries) {
      if (entry.isSymbolicLink() || visibleEntries.length >= MAX_DIRECTORY_ENTRIES) {
        continue;
      }
      const absolutePath = path.join(directoryPath, entry.name);
      const relativePath = toPosixPath(path.relative(assetsRoot, absolutePath));
      if (entry.isDirectory()) {
        visibleEntries.push({
          path: relativePath,
          name: entry.name,
          type: "directory",
          size: 0,
        });
      } else if (entry.isFile()) {
        const stats = await fs.stat(absolutePath);
        visibleEntries.push({
          ...toPublicFile({
            scope: "workspace",
            reference: `workspace:assets/${relativePath}`,
            relativePath: `assets/${relativePath}`,
            name: entry.name,
            size: stats.size,
          }),
          path: relativePath,
          type: "file",
        });
      }
    }

    return visibleEntries.sort((left, right) => {
      const typeOrder = left.type === right.type ? 0 : left.type === "directory" ? -1 : 1;
      return typeOrder || left.name.localeCompare(right.name);
    });
  }

  async uploadWorkspaceFiles(relativeDirectory, inputFiles) {
    const files = normalizeUploadFiles(inputFiles);
    const assetsRoot = await this.#requireAssetsRoot();
    const destinationDir = await requireAssetsEntry(
      assetsRoot,
      relativeDirectory,
      "directory",
      { allowRoot: true },
    );
    const stored = [];

    try {
      for (const file of files) {
        const targetPath = await writeUniqueFile(
          destinationDir,
          sanitizeFileName(file.name),
          file.data,
        );
        const relativePath = toPosixPath(path.relative(assetsRoot, targetPath));
        stored.push({
          ...toPublicFile({
            scope: "workspace",
            reference: `workspace:assets/${relativePath}`,
            relativePath: `assets/${relativePath}`,
            name: path.basename(targetPath),
            size: file.data.byteLength,
          }),
          path: relativePath,
          type: "file",
          absolutePath: targetPath,
        });
      }
    } catch (error) {
      await Promise.allSettled(stored.map((file) => fs.unlink(file.absolutePath)));
      throw error;
    }

    return stored.map(({ absolutePath: _absolutePath, ...file }) => file);
  }

  async createWorkspaceDirectory(relativeDirectory, name) {
    const assetsRoot = await this.#requireAssetsRoot();
    const parentPath = await requireAssetsEntry(
      assetsRoot,
      relativeDirectory,
      "directory",
      { allowRoot: true },
    );
    const directoryName = normalizeEntryName(name);
    const targetPath = resolveWithin(parentPath, directoryName);
    try {
      await fs.mkdir(targetPath);
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new AppWorkspaceError(
          "invalid_input",
          `"${directoryName}" already exists.`,
          { cause: error },
        );
      }
      throw error;
    }
    return {
      path: toPosixPath(path.relative(assetsRoot, targetPath)),
      name: directoryName,
      type: "directory",
      size: 0,
    };
  }

  async renameWorkspaceEntry(relativePath, name) {
    const assetsRoot = await this.#requireAssetsRoot();
    const sourcePath = await requireAssetsEntry(assetsRoot, relativePath);
    const targetName = normalizeEntryName(name);
    const targetPath = resolveWithin(path.dirname(sourcePath), targetName);
    if (targetPath === sourcePath) {
      return this.#toWorkspaceEntry(assetsRoot, sourcePath);
    }
    try {
      await fs.lstat(targetPath);
      throw new AppWorkspaceError("invalid_input", `"${targetName}" already exists.`);
    } catch (error) {
      if (error instanceof AppWorkspaceError) throw error;
      if (error?.code !== "ENOENT") throw error;
    }
    await fs.rename(sourcePath, targetPath);
    return this.#toWorkspaceEntry(assetsRoot, targetPath);
  }

  async moveWorkspaceEntries(relativePaths, destinationRelativeDirectory = "") {
    if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
      throw new AppWorkspaceError("invalid_input", "Choose at least one file or folder.");
    }
    const normalizedPaths = [
      ...new Set(relativePaths.map((entryPath) => normalizeRelativePath(entryPath))),
    ];
    if (normalizedPaths.length > MAX_MOVED_ENTRIES) {
      throw new AppWorkspaceError(
        "invalid_input",
        `Move up to ${MAX_MOVED_ENTRIES} items at once.`,
      );
    }

    const assetsRoot = await this.#requireAssetsRoot();
    const destinationPath = await requireAssetsEntry(
      assetsRoot,
      destinationRelativeDirectory,
      "directory",
      { allowRoot: true },
    );
    const moves = [];
    const targets = new Set();

    for (const relativePath of normalizedPaths) {
      const sourcePath = await requireAssetsEntry(assetsRoot, relativePath);
      if (path.dirname(sourcePath) === destinationPath) continue;
      if (sourcePath === destinationPath || isPathWithin(sourcePath, destinationPath)) {
        throw new AppWorkspaceError(
          "invalid_input",
          "A folder cannot be moved inside itself.",
        );
      }

      const targetPath = resolveWithin(destinationPath, path.basename(sourcePath));
      if (targets.has(targetPath)) {
        throw new AppWorkspaceError(
          "invalid_input",
          `"${path.basename(sourcePath)}" would conflict at the destination.`,
        );
      }
      targets.add(targetPath);
      try {
        await fs.lstat(targetPath);
        throw new AppWorkspaceError(
          "invalid_input",
          `"${path.basename(sourcePath)}" already exists at the destination.`,
        );
      } catch (error) {
        if (error instanceof AppWorkspaceError) throw error;
        if (error?.code !== "ENOENT") throw error;
      }
      moves.push({ sourcePath, targetPath });
    }

    const completed = [];
    try {
      for (const move of moves) {
        await fs.rename(move.sourcePath, move.targetPath);
        completed.push(move);
      }
    } catch (error) {
      await Promise.allSettled(
        completed.reverse().map((move) => fs.rename(move.targetPath, move.sourcePath)),
      );
      throw error;
    }

    return Promise.all(
      moves.map((move) => this.#toWorkspaceEntry(assetsRoot, move.targetPath)),
    );
  }

  async removeWorkspaceEntry(relativePath) {
    const assetsRoot = await this.#requireAssetsRoot();
    const targetPath = await requireAssetsEntry(assetsRoot, relativePath);
    await fs.rm(targetPath, { recursive: true });
  }

  async resolveWorkspaceFile(relativePath) {
    const assetsRoot = await this.#requireAssetsRoot();
    const absolutePath = await requireAssetsEntry(assetsRoot, relativePath, "file");
    const stats = await fs.stat(absolutePath);
    return {
      ...toPublicFile({
        scope: "workspace",
        reference: `workspace:assets/${toPosixPath(relativePath)}`,
        relativePath: `assets/${toPosixPath(relativePath)}`,
        name: path.basename(absolutePath),
        size: stats.size,
      }),
      absolutePath,
    };
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

  async #requireAssetsRoot() {
    const assetsRoot = path.join(this.#workspacePath, "assets");
    await fs.mkdir(assetsRoot, { recursive: true });
    await requireCanonicalChild(this.#workspacePath, assetsRoot);
    return assetsRoot;
  }

  async #toWorkspaceEntry(assetsRoot, absolutePath) {
    const stats = await fs.stat(absolutePath);
    const relativePath = toPosixPath(path.relative(assetsRoot, absolutePath));
    if (stats.isDirectory()) {
      return {
        path: relativePath,
        name: path.basename(absolutePath),
        type: "directory",
        size: 0,
      };
    }
    return {
      ...toPublicFile({
        scope: "workspace",
        reference: `workspace:assets/${relativePath}`,
        relativePath: `assets/${relativePath}`,
        name: path.basename(absolutePath),
        size: stats.size,
      }),
      path: relativePath,
      type: "file",
    };
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

async function requireAssetsEntry(
  assetsRoot,
  relativePath,
  expectedType,
  options = {},
) {
  const normalizedPath = normalizeRelativePath(relativePath, options.allowRoot);
  const absolutePath = normalizedPath
    ? resolveWithin(assetsRoot, normalizedPath)
    : path.resolve(assetsRoot);
  let stats;
  try {
    stats = await fs.lstat(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new AppWorkspaceError("not_found", "File or folder not found.", { cause: error });
    }
    throw error;
  }
  if (stats.isSymbolicLink()) {
    throw new AppWorkspaceError("not_found", "File or folder not found.");
  }
  if (
    (expectedType === "file" && !stats.isFile())
    || (expectedType === "directory" && !stats.isDirectory())
    || (!expectedType && !stats.isFile() && !stats.isDirectory())
  ) {
    throw new AppWorkspaceError("not_found", "File or folder not found.");
  }
  if (absolutePath !== path.resolve(assetsRoot)) {
    await requireCanonicalPathWithin(path.dirname(assetsRoot), assetsRoot, absolutePath);
  }
  return absolutePath;
}

function normalizeRelativePath(value, allowRoot = false) {
  const relativePath = toPosixPath(String(value ?? "").trim());
  if (!relativePath && allowRoot) return "";
  if (
    !relativePath
    || relativePath.startsWith("/")
    || relativePath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw invalidFileReference();
  }
  return relativePath;
}

function normalizeEntryName(value) {
  const name = String(value ?? "").trim();
  if (
    !name
    || name === "."
    || name === ".."
    || name.length > 180
    || /[/\\\u0000-\u001f\u007f]/.test(name)
  ) {
    throw new AppWorkspaceError("invalid_input", "Enter a valid file or folder name.");
  }
  return name;
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

async function requireCanonicalChild(root, candidate) {
  const [canonicalRoot, canonicalCandidate] = await Promise.all([
    fs.realpath(root),
    fs.realpath(candidate),
  ]);
  if (!isPathWithin(canonicalRoot, canonicalCandidate)) {
    throw invalidFileReference();
  }
}

function isPathWithin(root, candidate) {
  return candidate !== root && candidate.startsWith(`${root}${path.sep}`);
}

const MIME_TYPES = Object.freeze({
  ".aac": "audio/aac",
  ".avif": "image/avif",
  ".avi": "video/x-msvideo",
  ".bash": "text/x-shellscript",
  ".bmp": "image/bmp",
  ".c": "text/x-csrc",
  ".conf": "text/x-ini",
  ".cpp": "text/x-c++src",
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".go": "text/x-go",
  ".heic": "image/heic",
  ".html": "text/html",
  ".ini": "text/x-ini",
  ".java": "text/x-java-source",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".log": "text/x-log",
  ".md": "text/markdown",
  ".m4a": "audio/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".ogv": "video/ogg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".py": "application/x-python",
  ".rb": "text/x-ruby",
  ".rs": "text/x-rust",
  ".sh": "text/x-shellscript",
  ".svg": "image/svg+xml",
  ".toml": "text/x-toml",
  ".ts": "text/typescript",
  ".tsv": "text/tab-separated-values",
  ".txt": "text/plain",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".xml": "text/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
});
