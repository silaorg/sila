import { contextBridge, ipcRenderer } from 'electron';

export function setupChatGptImportPreload() {
  contextBridge.exposeInMainWorld('chatgptImport', {
    /**
     * Start parsing a ChatGPT export zip in main process from a file path
     * @param {string} filePath
     */
    parseFromPath(filePath) {
      return ipcRenderer.invoke('chatgpt-import:parse', { filePath });
    },
    onConversation(callback) {
      const listener = (_e, conv) => callback(conv);
      ipcRenderer.on('chatgpt-import:conversation', listener);
      return () => ipcRenderer.removeListener('chatgpt-import:conversation', listener);
    },
    onDone(callback) {
      const listener = (_e, summary) => callback(summary);
      ipcRenderer.on('chatgpt-import:done', listener);
      return () => ipcRenderer.removeListener('chatgpt-import:done', listener);
    },
    onError(callback) {
      const listener = (_e, err) => callback(err);
      ipcRenderer.on('chatgpt-import:error', listener);
      return () => ipcRenderer.removeListener('chatgpt-import:error', listener);
    }
  });
}

