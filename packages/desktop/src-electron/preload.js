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
  /**
   * Update progress/status stream from the main process.
   * @param {(payload: { kind?: 'electron'|'desktop-build', stage?: string, percent?: number|null, version?: string|null, message?: string }) => void} callback
   * @returns {() => void} unsubscribe
   */
  onUpdateProgress: (callback) => {
    /** @param {any} event @param {any} payload */
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on('sila:update:progress', listener);
    return () => ipcRenderer.removeListener('sila:update:progress', listener);
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

// Expose desktop search APIs to the renderer
contextBridge.exposeInMainWorld('desktopSearch', {
  /**
   * @param {string} spaceId
   */
  loadChatIndex: (spaceId) => {
    return ipcRenderer.invoke('sila:chat-search:load-index', spaceId);
  },
  /**
   * @param {string} spaceId
   * @param {Array<{ threadId: string; title: string; messages: string[]; updatedAt?: number }>} entries
   */
  saveChatIndex: (spaceId, entries) => {
    return ipcRenderer.invoke('sila:chat-search:save-index', { spaceId, entries });
  },
  /**
   * @param {string} spaceId
   * @param {string} query
   */
  queryChatIndex: (spaceId, query) => {
    return ipcRenderer.invoke('sila:chat-search:query', { spaceId, query });
  },
});

// Expose menu action listener to the renderer
contextBridge.exposeInMainWorld('desktopMenu', {
  /**
   * @param {(actionId: string) => void} callback
   * @returns {() => void} unsubscribe
   */
  onAction: (callback) => {
    /** @param {any} _event @param {string} actionId */
    const listener = (_event, actionId) => callback(actionId);
    ipcRenderer.on('sila:menu-action', listener);
    return () => ipcRenderer.removeListener('sila:menu-action', listener);
  }
});

// Expose main-process logs (forwarded via IPC in dev)
contextBridge.exposeInMainWorld('desktopLogs', {
  /**
   * @param {(payload: { level: 'log'|'info'|'warn'|'error', ts: number, message: string }) => void} callback
   * @returns {() => void} unsubscribe
   */
  onMainLog: (callback) => {
    /** @param {any} _event @param {any} payload */
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('sila:main:log', listener);
    return () => ipcRenderer.removeListener('sila:main:log', listener);
  }
});
