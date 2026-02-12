import { access, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import type { AppFileSystem, FileEntry, FileHandle, WatchEvent, UnwatchFn } from "@sila/core";

export class NodeFileSystem implements AppFileSystem {
  async readDir(targetPath: string): Promise<FileEntry[]> {
    const entries = await readdir(targetPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  }

  async exists(targetPath: string): Promise<boolean> {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async readTextFile(targetPath: string): Promise<string> {
    return await readFile(targetPath, "utf-8");
  }

  async readTextFileLines(targetPath: string): Promise<string[]> {
    const content = await this.readTextFile(targetPath);
    return content.split("\n").filter((line) => line.trim());
  }

  async writeTextFile(targetPath: string, content: string): Promise<void> {
    await writeFile(targetPath, content, "utf-8");
  }

  async create(targetPath: string): Promise<FileHandle> {
    const dir = targetPath.substring(0, targetPath.lastIndexOf("/"));
    if (dir) {
      await mkdir(dir, { recursive: true });
    }

    return {
      write: async (data: Uint8Array) => {
        await writeFile(targetPath, data);
      },
      close: async () => {},
    };
  }

  async open(targetPath: string, options?: { append?: boolean }): Promise<FileHandle> {
    return {
      write: async (data: Uint8Array) => {
        await writeFile(targetPath, data, { flag: options?.append ? "a" : "w" });
      },
      close: async () => {},
    };
  }

  async mkdir(targetPath: string, options?: { recursive?: boolean }): Promise<void> {
    await mkdir(targetPath, { recursive: options?.recursive });
  }

  async watch(
    _targetPath: string,
    _callback: (event: WatchEvent) => void,
    _options?: { recursive?: boolean },
  ): Promise<UnwatchFn> {
    return () => {};
  }

  async readBinaryFile(targetPath: string): Promise<Uint8Array> {
    const buf = await readFile(targetPath);
    return new Uint8Array(buf);
  }

  async delete(targetPath: string): Promise<void> {
    await unlink(targetPath);
  }
}
