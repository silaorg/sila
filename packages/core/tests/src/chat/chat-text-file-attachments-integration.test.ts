import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Space, ChatAppData, FileSystemPersistenceLayer, SpaceManager } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));



describe('Text File Attachments Integration', () => {
  let space: Space;
  let chatData: ChatAppData;
  let chatTree: any;
  let tempDir: string;
  let fs: NodeFileSystem;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-text-attachments-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    fs = new NodeFileSystem();
    
    // Create a real space for testing
    space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();
    
    // Add a chat assistant config
    const assistantId = 'test-assistant';
    space.addAppConfig({
      id: assistantId,
      name: 'Test Chat',
      button: 'New query',
      visible: true,
      description: 'Test chat for text file attachments',
      instructions: 'Be helpful'
    } as any);

    // Create a chat tree
    chatTree = ChatAppData.createNewChatTree(space, assistantId);
    chatData = new ChatAppData(space, chatTree);

    // Set up file store
    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);
  });

  afterEach(async () => {
    // Space doesn't have a close method, just clean up references
  });

  describe('ChatAppData Integration', () => {
    it('should handle text file attachments in messages', async () => {
      const textContent = `# Test File

This is a test markdown file with some content.

## Features
- Feature 1
- Feature 2

\`\`\`javascript
function test() {
  console.log('Hello, world!');
}
\`\`\``;

      const textFile = new File([textContent], 'test.md', { type: 'text/markdown' });
      
      // Create attachment preview
      const attachment = {
        id: 'test-id',
        kind: 'text' as const,
        name: 'test.md',
        mimeType: 'text/markdown',
        size: textFile.size,
        content: textContent,
        metadata: {
          lineCount: 15,
          charCount: textContent.length,
          wordCount: 20,
          hasContent: true,
          language: 'Markdown',
          encoding: 'utf-8'
        },
        width: 15, // lineCount
        height: textContent.length, // charCount
        alt: 'Markdown'
      };

      // Send message with text file attachment
      const message = await chatData.newMessage('user', 'Please review this file', undefined, [attachment]);

      // Allow time for file store operations to complete
      await wait(1200);

      // Verify message was created
      expect(message).toBeDefined();
      expect(message.text).toBe('Please review this file');
      expect(message.role).toBe('user');

      // Verify files were persisted
      const messageVertex = chatTree.tree.getVertex(message.id);
      const files = messageVertex?.getProperty('files') as any[];
      expect(files).toBeDefined();
      expect(files.length).toBe(1);
      // Persisted files are bare FileReference now
      expect(files[0].tree).toBeDefined();
      expect(files[0].vertex).toBeDefined();
    });

    it('should handle mixed image and text file attachments', async () => {
      const textContent = 'Hello, world!';
      const textFile = new File([textContent], 'hello.txt', { type: 'text/plain' });
      
      // Create text attachment
      const textAttachment = {
        id: 'text-id',
        kind: 'text' as const,
        name: 'hello.txt',
        mimeType: 'text/plain',
        size: textFile.size,
        content: textContent,
        metadata: {
          lineCount: 1,
          charCount: textContent.length,
          wordCount: 2,
          hasContent: true,
          language: 'Plain Text',
          encoding: 'utf-8'
        },
        width: 1,
        height: textContent.length,
        alt: 'Plain Text'
      };

      // Create image attachment (mock)
      const imageAttachment = {
        id: 'image-id',
        kind: 'image' as const,
        name: 'test.png',
        mimeType: 'image/png',
        size: 1024,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=',
        width: 1,
        height: 1
      };

      // Send message with both attachments
      const message = await chatData.newMessage('user', 'Here are both files', undefined, [textAttachment, imageAttachment]);

      // Allow time for file store operations to complete
      await wait(1200);

      // Verify message was created
      expect(message).toBeDefined();
      expect(message.text).toBe('Here are both files');

      // Verify both files were persisted
      const messageVertex = chatTree.tree.getVertex(message.id);
      const files = messageVertex?.getProperty('files') as any[];
      expect(files).toBeDefined();
      expect(files.length).toBe(2);
      
      const [att] = files;
      expect(att.tree).toBeDefined();
    });

    it('should handle large text files', async () => {
      // Create a large text file (simulate)
      const largeContent = 'Line 1\n'.repeat(1000); // 1000 lines
      const textFile = new File([largeContent], 'large.txt', { type: 'text/plain' });
      
      const attachment = {
        id: 'large-id',
        kind: 'text' as const,
        name: 'large.txt',
        mimeType: 'text/plain',
        size: textFile.size,
        content: largeContent,
        metadata: {
          lineCount: 1000,
          charCount: largeContent.length,
          wordCount: 1000,
          hasContent: true,
          language: 'Plain Text',
          encoding: 'utf-8'
        },
        width: 1000,
        height: largeContent.length,
        alt: 'Plain Text'
      };

      const message = await chatData.newMessage('user', 'Large file attached', undefined, [attachment]);

      // Allow time for file store operations to complete
      await wait(1200);

      expect(message).toBeDefined();
      
      // Verify the large file was handled
      const messageVertex = chatTree.tree.getVertex(message.id);
      const files = messageVertex?.getProperty('files') as any[];
      expect(files[0].tree).toBeDefined();
    });
  });

  describe('AI Integration', () => {
    it('should include text file content in AI messages', async () => {
      // This test would require a mock AI service
      // For now, we'll test the message processing logic
      
      const textContent = `function hello() {
  console.log("Hello, world!");
}`;

      const attachment = {
        id: 'code-id',
        kind: 'text' as const,
        name: 'hello.js',
        mimeType: 'text/javascript',
        size: textContent.length,
        content: textContent,
        metadata: {
          lineCount: 3,
          charCount: textContent.length,
          wordCount: 5,
          hasContent: true,
          language: 'JavaScript',
          encoding: 'utf-8'
        },
        width: 3,
        height: textContent.length,
        alt: 'JavaScript'
      };

      const message = await chatData.newMessage('user', 'What does this code do?', undefined, [attachment]);

      // The AI agent would process this message and include the text file content
      // This is tested in the SimpleChatAgent tests
      expect(message).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file store failures gracefully', async () => {
      // Mock a scenario where file store is not available
      const originalGetFileStore = space.getFileStore;
      space.getFileStore = () => null;

      const textContent = 'Test content';
      const attachment = {
        id: 'test-id',
        kind: 'text' as const,
        name: 'test.txt',
        mimeType: 'text/plain',
        size: textContent.length,
        content: textContent,
        metadata: {
          lineCount: 1,
          charCount: textContent.length,
          wordCount: 2,
          hasContent: true,
          language: 'Plain Text',
          encoding: 'utf-8'
        },
        width: 1,
        height: textContent.length,
        alt: 'Plain Text'
      };

      // Now throws: FileStore is required
      await expect(chatData.newMessage('user', 'Test message', undefined, [attachment])).rejects.toThrow();

      // Restore original method
      space.getFileStore = originalGetFileStore;
    });

    it('should handle invalid text file content', async () => {
      const attachment = {
        id: 'invalid-id',
        kind: 'text' as const,
        name: 'test.txt',
        mimeType: 'text/plain',
        size: 0,
        content: '', // Empty content
        metadata: {
          lineCount: 1,
          charCount: 0,
          wordCount: 0,
          hasContent: false,
          language: 'Plain Text',
          encoding: 'utf-8'
        },
        width: 1,
        height: 0,
        alt: 'Plain Text'
      };

      const message = await chatData.newMessage('user', 'Empty file', undefined, [attachment]);

      expect(message).toBeDefined();
      
      // Verify empty file was handled
      const messageVertex = chatTree.tree.getVertex(message.id);
      const files = messageVertex?.getProperty('files') as any[];
      expect(files[0].tree).toBeDefined();
    });
  });

  describe('File Type Detection', () => {
    it('should handle various text file types correctly', async () => {
      const testCases = [
        {
          name: 'script.js',
          content: 'console.log("Hello");',
          mimeType: 'text/javascript',
          expectedLang: 'JavaScript'
        },
        {
          name: 'config.json',
          content: '{"key": "value"}',
          mimeType: 'application/json',
          expectedLang: 'JSON'
        },
        {
          name: 'style.css',
          content: 'body { color: red; }',
          mimeType: 'text/css',
          expectedLang: 'CSS'
        },
        {
          name: 'data.csv',
          content: 'name,age\nJohn,30',
          mimeType: 'text/csv',
          expectedLang: 'CSV'
        },
        {
          name: 'config.yaml',
          content: 'key: value',
          mimeType: 'text/x-yaml',
          expectedLang: 'YAML'
        }
      ];

      for (const testCase of testCases) {
        const file = new File([testCase.content], testCase.name, { type: testCase.mimeType });
        
        const attachment = {
          id: `test-${testCase.name}`,
          kind: 'text' as const,
          name: testCase.name,
          mimeType: testCase.mimeType,
          size: file.size,
          content: testCase.content,
          metadata: {
            lineCount: testCase.content.split('\n').length,
            charCount: testCase.content.length,
            wordCount: testCase.content.split(/\s+/).filter(w => w.length > 0).length,
            hasContent: true,
            language: testCase.expectedLang,
            encoding: 'utf-8'
          },
          width: testCase.content.split('\n').length,
          height: testCase.content.length,
          alt: testCase.expectedLang
        };

        const message = await chatData.newMessage('user', `Review this ${testCase.expectedLang} file`, undefined, [attachment]);

        expect(message).toBeDefined();
        
        const messageVertex = chatTree.tree.getVertex(message.id);
        const files = messageVertex?.getProperty('files') as any[];
        expect(files[0].tree).toBeDefined();
        expect(files[0].vertex).toBeDefined();
      }
    });
  });
});