import { ipcMain } from 'electron';

export function setupChatGptImportIpc() {
  // Stream-like import: main parses and emits chunks to renderer
  ipcMain.handle('chatgpt-import:parse', async (event, { filePath }) => {
    const parser = await import('chatgpt-export-parser');

    return new Promise((resolve, reject) => {
      try {
        const webContents = event.sender;
        
        if (typeof parser.parseExport === 'function') {
          parser.parseExport(filePath).then((data) => {
            let conversations = data.conversations || [];
            const totalConversations = conversations.length;

            // For tests: limit to 30 conversations
            conversations = conversations.slice(0, 30);
            
            // Process conversations in chunks to avoid memory issues
            const CHUNK_SIZE = 10; // Process 10 conversations at a time
            let processedCount = 0;
            
            function processNextChunk() {
              const startIndex = processedCount;
              const endIndex = Math.min(startIndex + CHUNK_SIZE, totalConversations);
              
              // Send chunk of conversations
              for (let i = startIndex; i < endIndex; i++) {
                webContents.send('chatgpt-import:conversation', conversations[i]);
              }
              
              processedCount = endIndex;
              
              // Send progress update
              const progress = Math.round((processedCount / totalConversations) * 100);
              webContents.send('chatgpt-import:progress', { 
                processed: processedCount, 
                total: totalConversations, 
                progress 
              });
              
              // If we've processed all conversations, send done event
              if (processedCount >= totalConversations) {
                webContents.send('chatgpt-import:done', { conversations: totalConversations });
                resolve(true);
              } else {
                // Process next chunk after a small delay to allow UI to update
                setTimeout(processNextChunk, 10);
              }
            }
            
            // Start processing
            processNextChunk();
            
          }).catch((err) => {
            webContents.send('chatgpt-import:error', String(err?.message || err));
            reject(err);
          });
        } else {
          reject(new Error('chatgpt-export-parser: parseExport function not found'));
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

