import { mkdir, writeFile, readFile, readdir, access, unlink } from 'fs/promises';
import type { AppFileSystem, FileEntry, FileHandle, WatchEvent, UnwatchFn } from "@sila/core";

export class NodeFileSystem implements AppFileSystem {
  async readDir(path: string): Promise<FileEntry[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    }));
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async readTextFile(path: string): Promise<string> {
    return await readFile(path, 'utf-8');
  }

  async readTextFileLines(path: string): Promise<string[]> {
    const content = await this.readTextFile(path);
    return content.split('\n').filter(line => line.trim());
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf-8');
  }

  async create(path: string): Promise<FileHandle> {
    // Create directory if needed
    const dir = path.substring(0, path.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    
    return {
      write: async (data: Uint8Array) => {
        await writeFile(path, data);
      },
      close: async () => {
        // No-op for Node.js
      }
    };
  }

  async open(path: string, options?: { append?: boolean }): Promise<FileHandle> {
    return {
      write: async (data: Uint8Array) => {
        const content = new TextDecoder().decode(data);
        if (options?.append) {
          await writeFile(path, content, { flag: 'a' });
        } else {
          await writeFile(path, content);
        }
      },
      close: async () => {
        // No-op for Node.js
      }
    };
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await mkdir(path, { recursive: options?.recursive });
  }

  async watch(path: string, callback: (event: WatchEvent) => void, options?: { recursive?: boolean }): Promise<UnwatchFn> {
    // For build scripts, we don't need file watching
    return () => {};
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const buf = await readFile(path);
    return new Uint8Array(buf);
  }

  async delete(path: string): Promise<void> {
    await unlink(path);
  }
} 