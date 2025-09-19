import type { AppFileSystem, FileEntry, FileHandle, WatchEvent, UnwatchFn } from '@sila/client/appFs';

// Extend the Window interface to include the electronFs API
declare global {
  interface Window {
    electronFs: AppFileSystem;
  }
}

/**
 * Wrapper class that implements AppFileSystem interface
 * by delegating to the exposed electronFs API from the preload script
 */
export class ElectronFsWrapper implements AppFileSystem {
  private get api() {
    if (!window.electronFs) {
      throw new Error('electronFs not available. Make sure the preload script is loaded.');
    }
    return window.electronFs;
  }

  async readDir(path: string): Promise<FileEntry[]> {
    return this.api.readDir(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.api.exists(path);
  }

  async readTextFile(path: string): Promise<string> {
    return this.api.readTextFile(path);
  }

  async readTextFileLines(path: string): Promise<string[]> {
    return this.api.readTextFileLines(path);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    return this.api.writeTextFile(path, content);
  }

  async create(path: string): Promise<FileHandle> {
    return this.api.create(path);
  }

  async open(path: string, options?: { append?: boolean }): Promise<FileHandle> {
    return this.api.open(path, options);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.api.mkdir(path, options);
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    return this.api.readBinaryFile(path);
  }

  async watch(
    path: string,
    callback: (event: WatchEvent) => void,
    options?: { recursive?: boolean }
  ): Promise<UnwatchFn> {
    return this.api.watch(path, callback, options);
  }

  async delete(path: string): Promise<void> {
    return this.api.delete(path);
  }
}

export const electronFsWrapper = new ElectronFsWrapper(); 