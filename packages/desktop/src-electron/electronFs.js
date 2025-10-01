import * as fs from 'fs/promises';
import * as path from 'path';
import { watch } from 'chokidar';
import { contextBridge } from 'electron';

export function setupFSInPreloader() {
  // Expose the file system API to the renderer process
  contextBridge.exposeInMainWorld('electronFs', {
    /**
     * @param {string} path
     */
    readDir: (path) => electronFs.readDir(path),

    /**
     * @param {string} path
     */
    exists: (path) => electronFs.exists(path),

    /**
     * @param {string} path
     */
    readTextFile: (path) => electronFs.readTextFile(path),

    /**
     * @param {string} path
     */
    readTextFileLines: (path) => electronFs.readTextFileLines(path),

    /**
     * @param {string} path
     * @param {string} content
     */
    writeTextFile: (path, content) => electronFs.writeTextFile(path, content),

    /**
     * @param {string} path
     */
    create: (path) => electronFs.create(path),

    /**
     * @param {string} path
     * @param {Object} [options]
     */
    open: (path, options) => electronFs.open(path, options),

    /**
     * @param {string} path
     * @param {Object} [options]
     */
    mkdir: (path, options) => electronFs.mkdir(path, options),

    /**
     * @param {string} path
     */
    readBinaryFile: (path) => electronFs.readBinaryFile(path),

    /**
     * @param {string} path
     * @param {function(Object): void} callback
     * @param {Object} [options]
     */
    watch: (path, callback, options) => electronFs.watch(path, callback, options)
  });
}

/**
 * @typedef {Object} FileEntry
 * @property {string} name
 * @property {boolean} isDirectory
 * @property {boolean} isFile
 */

/**
 * @typedef {Object} FileHandle
 * @property {function(Uint8Array): Promise<void>} write
 * @property {function(): Promise<void>} close
 */

/**
 * @typedef {import('@sila/client/appFs').WatchEvent} WatchEvent
 */

/**
 * @typedef {import('@sila/client/appFs').UnwatchFn} UnwatchFn
 */

export class ElectronFileSystem {
  /**
   * @param {string} dirPath - The directory path to read
   * @returns {Promise<FileEntry[]>}
   */
  async readDir(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
      }));
    } catch (error) {
      console.error('Failed to read directory:', dirPath, error);
      throw error;
    }
  }

  /**
   * @param {string} filePath - The file path to check
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} filePath - The file path to read
   * @returns {Promise<string>}
   */
  async readTextFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.error('Failed to read file:', filePath, error);
      throw error;
    }
  }

  /**
   * @param {string} filePath - The file path to read
   * @returns {Promise<string[]>}
   */
  async readTextFileLines(filePath) {
    const content = await this.readTextFile(filePath);
    const lines = content.split('\n');

    return lines;
  }

  /**
   * @param {string} filePath - The file path to write to
   * @param {string} content - The content to write
   * @returns {Promise<void>}
   */
  async writeTextFile(filePath, content) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to write file:', filePath, error);
      throw error;
    }
  }

  /**
   * @param {string} filePath - The file path to create
   * @returns {Promise<FileHandle>}
   */
  async create(filePath) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Create the file if it doesn't exist
      const fileHandle = await fs.open(filePath, 'w');

      return {
        /**
         * @param {Uint8Array} data - The data to write
         * @returns {Promise<void>}
         */
        async write(data) {
          await fileHandle.write(data);
        },
        /**
         * @returns {Promise<void>}
         */
        async close() {
          await fileHandle.close();
        }
      };
    } catch (error) {
      console.error('Failed to create file:', filePath, error);
      throw error;
    }
  }

  /**
   * @param {string} filePath - The file path to open
   * @param {Object} [options] - Open options
   * @param {boolean} [options.append] - Whether to append to the file
   * @returns {Promise<FileHandle>}
   */
  async open(filePath, options) {
    try {
      const flag = options?.append ? 'a' : 'w';
      const fileHandle = await fs.open(filePath, flag);

      return {
        /**
         * @param {Uint8Array} data - The data to write
         * @returns {Promise<void>}
         */
        async write(data) {
          await fileHandle.write(data);
        },
        /**
         * @returns {Promise<void>}
         */
        async close() {
          await fileHandle.close();
        }
      };
    } catch (error) {
      console.error('Failed to open file:', filePath, error);
      throw error;
    }
  }

  /**
   * @param {string} dirPath - The directory path to create
   * @param {Object} [options] - Directory creation options
   * @param {boolean} [options.recursive] - Whether to create parent directories
   * @returns {Promise<void>}
   */
  async mkdir(dirPath, options) {
    try {
      await fs.mkdir(dirPath, { recursive: options?.recursive || false });
    } catch (error) {
      console.error('Failed to create directory:', dirPath, error);
      throw error;
    }
  }

  /**
   * @param {string} filePath - The file path to read as bytes
   * @returns {Promise<Uint8Array>}
   */
  async readBinaryFile(filePath) {
    try {
      const buf = await fs.readFile(filePath);
      return new Uint8Array(buf);
    } catch (error) {
      console.error('Failed to read binary file:', filePath, error);
      throw error;
    }
  }

  /**
   * @param {string} watchPath - The path to watch
   * @param {function(WatchEvent): void} callback - The callback function
   * @param {Object} [options] - Watch options
   * @param {boolean} [options.recursive] - Whether to watch recursively
   * @returns {Promise<UnwatchFn>}
   */
  async watch(watchPath, callback, options) {
    try {
      const watcher = watch(watchPath, {
        persistent: true,
        ignoreInitial: true
      });

      watcher.on('add', (filePath) => {
        callback({
          event: 'add',
          path: filePath
        });
      });

      watcher.on('addDir', (dirPath) => {
        callback({
          event: 'addDir',
          path: dirPath
        });
      });

      watcher.on('change', (filePath) => {
        callback({
          event: 'change',
          path: filePath
        });
      });

      watcher.on('unlink', (filePath) => {
        callback({
          event: 'unlink',
          path: filePath
        });
      });

      watcher.on('unlinkDir', (dirPath) => {
        callback({
          event: 'unlinkDir',
          path: dirPath
        });
      });

      watcher.on('error', (error) => {
        // Log file watcher errors as warnings rather than errors since they're often non-critical
        // Common causes: permission issues, deleted directories, network filesystem issues
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('File watcher encountered an issue (this is usually non-critical):', errorMessage);
      });

      return () => {
        watcher.close();
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Failed to set up file watcher for:', watchPath, errorMessage);
      // Return a no-op function instead of throwing to allow the app to continue
      return () => {
        console.log('File watcher was not set up, no cleanup needed');
      };
    }
  }
}

export const electronFs = new ElectronFileSystem(); 