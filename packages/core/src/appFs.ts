// File system interface types
export interface FileEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileHandle {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface WatchEvent {
  event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir';
  path: string;
}

export type UnwatchFn = () => void;

// Main file system interface
export interface AppFileSystem {
  readDir(path: string): Promise<FileEntry[]>;
  exists(path: string): Promise<boolean>;
  readTextFile(path: string): Promise<string>;
  readTextFileLines(path: string): Promise<string[]>;
  writeTextFile(path: string, content: string): Promise<void>;
  create(path: string): Promise<FileHandle>;
  open(path: string, options?: { append?: boolean }): Promise<FileHandle>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  watch(path: string, callback: (event: WatchEvent) => void, options?: { recursive?: boolean }): Promise<UnwatchFn>;
  readBinaryFile(path: string): Promise<Uint8Array>;
  delete(path: string): Promise<void>;
} 