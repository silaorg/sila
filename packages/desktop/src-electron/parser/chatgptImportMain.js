import { ipcMain } from 'electron';

export function setupChatGptImportIpc() {
  // Stream-like import: main parses and emits chunks to renderer
  ipcMain.handle('chatgpt-import:parse', async (event, { filePath }) => {
    const { default: fs } = await import('fs');
    const { parseZipStream } = await import('chatgpt-export-parser');

    return new Promise((resolve, reject) => {
      try {
        const stream = fs.createReadStream(filePath);
        // Fallback if parseZipStream is not available
        if (!parseZipStream) {
          reject(new Error('chatgpt-export-parser: parseZipStream is not available'));
          return;
        }

        const webContents = event.sender;
        parseZipStream(stream, {
          onConversation: (conv) => {
            webContents.send('chatgpt-import:conversation', conv);
          },
          onDone: (summary) => {
            webContents.send('chatgpt-import:done', summary);
            resolve(true);
          },
          onError: (err) => {
            webContents.send('chatgpt-import:error', String(err?.message || err));
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

