import { setupDialogsInPreloader } from './dialogs/electronDialog.js';
import { setupFSInPreloader} from './electronFs.js';
import { setupFileSystemAPI } from './fileSystemAPI.js';
import { contextBridge, ipcRenderer } from 'electron';

// So our app can use the file system
setupFSInPreloader();

// So our app can use the native dialogs
setupDialogsInPreloader();

// So our app can use the file protocol
setupFileSystemAPI();

// Expose updater APIs to the renderer
contextBridge.exposeInMainWorld('desktopUpdater', {
  /**
   * @param {(payload: { version?: string|null }) => void} callback
   */
  onUpdateDownloaded: (callback) => {
    /** @param {any} event @param {{ version?: string|null }} payload */
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on('sila:update:downloaded', listener);
    return () => ipcRenderer.removeListener('sila:update:downloaded', listener);
  },
  /**
   * @param {(payload: { version?: string|null }) => void} callback
   */
  onDesktopBuildReady: (callback) => {
    /** @param {any} event @param {{ version?: string|null }} payload */
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on('sila:build:update:ready', listener);
    return () => ipcRenderer.removeListener('sila:build:update:ready', listener);
  },
  installUpdate: () => ipcRenderer.invoke('sila:update:install')
});

// Expose proxyFetch to renderer
contextBridge.exposeInMainWorld('desktopNet', {
  /**
   * @param {string} url
   * @param {RequestInit} [init]
   */
  proxyFetch: async (url, init) => {
    // Return a plain serializable object across the context bridge
    return await ipcRenderer.invoke('sila:proxyFetch', url, init);
  }
});