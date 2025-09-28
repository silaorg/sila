import { ipcMain } from 'electron';

export function setupChatGptImportIpc() {
  // Stream-like import: main parses and emits chunks to renderer
  ipcMain.handle('chatgpt-import:parse', async (event, { filePath }) => {
    const { default: fs } = await import('fs');
    const parser = await import('chatgpt-export-parser');

    return new Promise((resolve, reject) => {
      try {
        const stream = fs.createReadStream(filePath);

        const webContents = event.sender;
        if (typeof parser.parseZipStream === 'function') {
          parser.parseZipStream(stream, {
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
        } else if (typeof parser.parseZip === 'function') {
          parser.parseZip(stream).then((data) => {
            for (const conv of data.conversations || []) {
              webContents.send('chatgpt-import:conversation', conv);
            }
            webContents.send('chatgpt-import:done', { conversations: data.conversations?.length || 0 });
            resolve(true);
          }).catch((err) => {
            webContents.send('chatgpt-import:error', String(err?.message || err));
            reject(err);
          });
        } else if (typeof parser.default === 'function') {
          parser.default(stream).then((data) => {
            for (const conv of data.conversations || []) {
              webContents.send('chatgpt-import:conversation', conv);
            }
            webContents.send('chatgpt-import:done', { conversations: data.conversations?.length || 0 });
            resolve(true);
          }).catch((err) => {
            webContents.send('chatgpt-import:error', String(err?.message || err));
            reject(err);
          });
        } else {
          reject(new Error('chatgpt-export-parser: no supported API found'));
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

