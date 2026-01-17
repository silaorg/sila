import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type {
  AppFileSystem,
  FileEntry,
  FileHandle,
  WatchEvent,
  UnwatchFn
} from "@sila/client/appFs";

const CAPACITOR_SCHEME = "capacitor://";
const SPACE_ROOT = "spaces";

function base64ToBytes(data: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(data, "base64"));
  }

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(data: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data).toString("base64");
  }

  let binary = "";
  data.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function normalizePath(rawPath: string): string {
  const trimmed = rawPath.replace(/\\/g, "/");

  if (trimmed.startsWith(CAPACITOR_SCHEME)) {
    const withoutScheme = trimmed.slice(CAPACITOR_SCHEME.length).replace(/^\/+/, "");
    const withoutRoot = withoutScheme.startsWith(`${SPACE_ROOT}/`)
      ? withoutScheme.slice(SPACE_ROOT.length + 1)
      : withoutScheme;
    return withoutRoot ? `${SPACE_ROOT}/${withoutRoot}` : SPACE_ROOT;
  }

  return trimmed.replace(/^\/+/, "");
}

function getParentPath(path: string): string | null {
  const index = path.lastIndexOf("/");
  if (index <= 0) {
    return null;
  }
  return path.slice(0, index);
}

class CapacitorFileHandle implements FileHandle {
  constructor(
    private path: string,
    private append: boolean,
    private fs: CapacitorFsWrapper
  ) {}

  async write(data: Uint8Array): Promise<void> {
    await this.fs.writeBinaryFile(this.path, data, this.append);
  }

  async close(): Promise<void> {}
}

export class CapacitorFsWrapper implements AppFileSystem {
  private async ensureParentDirectory(path: string): Promise<void> {
    const parent = getParentPath(path);
    if (!parent) {
      return;
    }

    await Filesystem.mkdir({
      path: parent,
      directory: Directory.Data,
      recursive: true
    });
  }

  private async writeBinaryFile(
    path: string,
    data: Uint8Array,
    append: boolean
  ): Promise<void> {
    const resolvedPath = normalizePath(path);

    if (append && (await this.exists(path))) {
      const existing = await this.readBinaryFile(path);
      const merged = new Uint8Array(existing.length + data.length);
      merged.set(existing);
      merged.set(data, existing.length);
      await Filesystem.writeFile({
        path: resolvedPath,
        data: bytesToBase64(merged),
        directory: Directory.Data
      });
      return;
    }

    await Filesystem.writeFile({
      path: resolvedPath,
      data: bytesToBase64(data),
      directory: Directory.Data
    });
  }

  async readDir(path: string): Promise<FileEntry[]> {
    const resolvedPath = normalizePath(path);

    if (!await this.exists(path)) {
      return [];
    }

    const result = await Filesystem.readdir({
      path: resolvedPath,
      directory: Directory.Data
    });

    const entries = await Promise.all(result.files.map(async (entry: any) => {
      if (typeof entry === "string") {
        let isDirectory = false;
        let isFile = false;

        try {
          const stat = await Filesystem.stat({
            path: `${resolvedPath}/${entry}`,
            directory: Directory.Data
          });
          isDirectory = stat.type === "directory";
          isFile = stat.type === "file";
        } catch {
          isFile = true;
        }

        return {
          name: entry,
          isDirectory,
          isFile
        };
      }

      return {
        name: entry.name,
        isDirectory: entry.type === "directory",
        isFile: entry.type === "file"
      };
    }));

    return entries;
  }

  async exists(path: string): Promise<boolean> {
    const resolvedPath = normalizePath(path);

    try {
      await Filesystem.stat({
        path: resolvedPath,
        directory: Directory.Data
      });
      return true;
    } catch {
      return false;
    }
  }

  async readTextFile(path: string): Promise<string> {
    const resolvedPath = normalizePath(path);
    const result = await Filesystem.readFile({
      path: resolvedPath,
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });

    return result.data;
  }

  async readTextFileLines(path: string): Promise<string[]> {
    const content = await this.readTextFile(path);
    return content.split("\n").filter((line) => line.trim());
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const resolvedPath = normalizePath(path);
    await this.ensureParentDirectory(resolvedPath);
    await Filesystem.writeFile({
      path: resolvedPath,
      data: content,
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
  }

  async create(path: string): Promise<FileHandle> {
    const resolvedPath = normalizePath(path);
    await this.ensureParentDirectory(resolvedPath);
    return new CapacitorFileHandle(path, false, this);
  }

  async open(path: string, options?: { append?: boolean }): Promise<FileHandle> {
    const resolvedPath = normalizePath(path);
    await this.ensureParentDirectory(resolvedPath);
    return new CapacitorFileHandle(path, Boolean(options?.append), this);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const resolvedPath = normalizePath(path);
    await Filesystem.mkdir({
      path: resolvedPath,
      directory: Directory.Data,
      recursive: Boolean(options?.recursive)
    });
  }

  async watch(
    path: string,
    callback: (event: WatchEvent) => void,
    options?: { recursive?: boolean }
  ): Promise<UnwatchFn> {
    return () => {};
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const resolvedPath = normalizePath(path);
    const result = await Filesystem.readFile({
      path: resolvedPath,
      directory: Directory.Data
    });

    if (!result.data) {
      return new Uint8Array();
    }

    return base64ToBytes(result.data);
  }

  async delete(path: string): Promise<void> {
    const resolvedPath = normalizePath(path);

    try {
      const stat = await Filesystem.stat({
        path: resolvedPath,
        directory: Directory.Data
      });

      if (stat.type === "directory") {
        await Filesystem.rmdir({
          path: resolvedPath,
          directory: Directory.Data,
          recursive: true
        });
        return;
      }

      await Filesystem.deleteFile({
        path: resolvedPath,
        directory: Directory.Data
      });
    } catch {
      return;
    }
  }
}

export const capacitorFsWrapper = new CapacitorFsWrapper();
