import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Space, ChatAppData, FileSystemPersistenceLayer, SpaceManager, SimpleChatAgent, AgentServices } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Text File AI Integration', () => {
  let space: Space;
  let chatData: ChatAppData;
  let chatTree: any;
  let tempDir: string;
  let fs: NodeFileSystem;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-text-ai-test-'));
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
      instructions: 'You are a helpful assistant. When asked about file contents, respond with the exact content you see.'
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
    // Clean up
  });

  describe('Simple Number File Test', () => {
    it('should include text file content in AI message processing', async () => {
      // Create a simple text file with just a number
      const textContent = '8899';
      const textFile = new File([textContent], 'test-number.txt', { type: 'text/plain' });
      
      // Create attachment preview
      const attachment = {
        id: 'test-id',
        kind: 'text' as const,
        name: 'test-number.txt',
        mimeType: 'text/plain',
        size: textFile.size,
        content: textContent,
        metadata: {
          lineCount: 1,
          charCount: textContent.length,
          wordCount: 1,
          hasContent: true,
          language: 'Plain Text',
          encoding: 'utf-8'
        },
        width: 1, // lineCount
        height: textContent.length, // charCount
        alt: 'Plain Text'
      };

      // Send message with text file attachment
      const message = await chatData.newMessage('user', 'What number is in this file?', undefined, [attachment]);

      // Allow time for file store operations to complete
      await wait(1200);

      // Verify message was created
      expect(message).toBeDefined();
      expect(message.text).toBe('What number is in this file?');
      expect(message.role).toBe('user');

      // Verify files were persisted
      const messageVertex = chatTree.tree.getVertex(message.id);
      const files = messageVertex?.getProperty('files') as any[];
      expect(files).toBeDefined();
      expect(files.length).toBe(1);
      // Persisted files are bare FileReference
      expect(files[0].tree).toBeDefined();
      expect(files[0].vertex).toBeDefined();

      // Test the AI processing by simulating what SimpleChatAgent would do
      const agentServices = new AgentServices(space);
      const config = space.getAppConfig('test-assistant');
      const simpleChatAgent = new SimpleChatAgent(agentServices, config!);

      // Resolve message attachments (simulate what ChatAppBackend does)
      const resolvedMessage = await chatData.resolveMessageFiles(message);
      
      // Test the message processing logic
      const processedMessages = [
        { role: 'system', text: config!.instructions },
        resolvedMessage
      ];

      // Extract text files from the resolved message
      const resolvedAttachments = (resolvedMessage as any).files || [];
      const textFiles = resolvedAttachments.filter((a: any) => a?.mimeType?.startsWith('text/') || a?.kind === 'text');

      console.log('Resolved attachments:', {
        total: resolvedAttachments.length,
        textFiles: textFiles.length,
        details: textFiles.map((tf: any) => ({
          name: tf.name,
          hasFileRef: !!(tf.file?.tree && tf.file?.vertex),
          hasDataUrl: !!tf.dataUrl,
          dataUrlPreview: tf.dataUrl ? tf.dataUrl.substring(0, 50) + '...' : null
        }))
      });

      // Test content extraction
      let extractedContent = '';
      for (const textFile of textFiles) {
        let fileContent: string | null = null;
        
        if (textFile.dataUrl) {
          // Extract from data URL
          fileContent = simpleChatAgent['extractTextFromDataUrl'](textFile.dataUrl);
        }
        
        if (fileContent) {
          const fileHeader = `\n\n--- File: ${textFile.name} (${textFile.alt || 'text'}) ---\n`;
          extractedContent += fileHeader + fileContent;
        }
      }

      console.log('Extracted content:', {
        length: extractedContent.length,
        content: extractedContent
      });

      // Verify that the content was extracted correctly
      expect(extractedContent).toContain('8899');
      expect(extractedContent).toContain('test-number.txt');
    });
  });

  describe('Markdown File Test', () => {
    it('should handle markdown files correctly', async () => {
      // Create a markdown file
      const textContent = `# Test File

This is a test markdown file.

## Number
The number is: **8899**

## Code
\`\`\`javascript
function test() {
  return 8899;
}
\`\`\``;

      const textFile = new File([textContent], 'test.md', { type: 'text/markdown' });
      
      const attachment = {
        id: 'md-test-id',
        kind: 'text' as const,
        name: 'test.md',
        mimeType: 'text/markdown',
        size: textFile.size,
        content: textContent,
        metadata: {
          lineCount: textContent.split('\n').length,
          charCount: textContent.length,
          wordCount: textContent.split(/\s+/).filter(w => w.length > 0).length,
          hasContent: true,
          language: 'Markdown',
          encoding: 'utf-8'
        },
        width: textContent.split('\n').length,
        height: textContent.length,
        alt: 'Markdown'
      };

      const message = await chatData.newMessage('user', 'What is the number in this markdown file?', undefined, [attachment]);
      await wait(1200);

      // Test content extraction
      const agentServices = new AgentServices(space);
      const config = space.getAppConfig('test-assistant');
      const simpleChatAgent = new SimpleChatAgent(agentServices, config!);

      const resolvedMessage = await chatData.resolveMessageFiles(message);
      const resolvedAttachments = (resolvedMessage as any).files || [];
      const textFiles = resolvedAttachments.filter((a: any) => 
        a?.kind === 'text' && (a?.file?.tree && a?.file?.vertex || a?.dataUrl)
      );

      let extractedContent = '';
      for (const textFile of textFiles) {
        let fileContent: string | null = null;
        
        if (textFile.file?.tree && textFile.file?.vertex) {
          fileContent = await simpleChatAgent['loadTextFileContent'](textFile.file.tree, textFile.file.vertex);
        } else if (textFile.dataUrl) {
          fileContent = simpleChatAgent['extractTextFromDataUrl'](textFile.dataUrl);
        }
        
        if (fileContent) {
          const fileHeader = `\n\n--- File: ${textFile.name} (${textFile.alt || 'text'}) ---\n`;
          extractedContent += fileHeader + fileContent;
        }
      }

      // Verify markdown content was extracted
      expect(extractedContent).toContain('8899');
      expect(extractedContent).toContain('test.md');
      // Label is derived at render-time; check content instead, case-insensitive
      expect(extractedContent.toLowerCase()).toContain('markdown');
      expect(extractedContent).toContain('# Test File');
    });
  });

  describe('Multiple Text Files Test', () => {
    it('should handle multiple text files in one message', async () => {
      const file1Content = '8899';
      const file2Content = 'Hello World';
      
      const attachment1 = {
        id: 'file1-id',
        kind: 'text' as const,
        name: 'number.txt',
        mimeType: 'text/plain',
        size: file1Content.length,
        content: file1Content,
        metadata: {
          lineCount: 1,
          charCount: file1Content.length,
          wordCount: 1,
          hasContent: true,
          language: 'Plain Text',
          encoding: 'utf-8'
        },
        width: 1,
        height: file1Content.length,
        alt: 'Plain Text'
      };

      const attachment2 = {
        id: 'file2-id',
        kind: 'text' as const,
        name: 'greeting.txt',
        mimeType: 'text/plain',
        size: file2Content.length,
        content: file2Content,
        metadata: {
          lineCount: 1,
          charCount: file2Content.length,
          wordCount: 2,
          hasContent: true,
          language: 'Plain Text',
          encoding: 'utf-8'
        },
        width: 1,
        height: file2Content.length,
        alt: 'Plain Text'
      };

      const message = await chatData.newMessage('user', 'What are the contents of these files?', undefined, [attachment1, attachment2]);
      await wait(1200);

      // Test content extraction
      const agentServices = new AgentServices(space);
      const config = space.getAppConfig('test-assistant');
      const simpleChatAgent = new SimpleChatAgent(agentServices, config!);

      const resolvedMessage = await chatData.resolveMessageFiles(message);
      const resolvedAttachments = (resolvedMessage as any).files || [];
      const textFiles = resolvedAttachments.filter((a: any) => 
        a?.kind === 'text' && (a?.file?.tree && a?.file?.vertex || a?.dataUrl)
      );

      expect(textFiles.length).toBe(2);

      let extractedContent = '';
      for (const textFile of textFiles) {
        let fileContent: string | null = null;
        
        if (textFile.file?.tree && textFile.file?.vertex) {
          fileContent = await simpleChatAgent['loadTextFileContent'](textFile.file.tree, textFile.file.vertex);
        } else if (textFile.dataUrl) {
          fileContent = simpleChatAgent['extractTextFromDataUrl'](textFile.dataUrl);
        }
        
        if (fileContent) {
          const fileHeader = `\n\n--- File: ${textFile.name} (${textFile.alt || 'text'}) ---\n`;
          extractedContent += fileHeader + fileContent;
        }
      }

      // Verify both files were extracted
      expect(extractedContent).toContain('8899');
      expect(extractedContent).toContain('Hello World');
      expect(extractedContent).toContain('number.txt');
      expect(extractedContent).toContain('greeting.txt');
    });
  });

  describe('Data URL Extraction Test', () => {
    it('should correctly extract text from data URLs', async () => {
      const simpleChatAgent = new SimpleChatAgent({} as any, {} as any);
      
      // Test with plain text data URL
      const plainTextDataUrl = 'data:text/plain;base64,ODg5OQ=='; // "8899" in base64
      const extractedPlain = simpleChatAgent['extractTextFromDataUrl'](plainTextDataUrl);
      expect(extractedPlain).toBe('8899');

      // Test with markdown data URL
      const markdownContent = '# Test\nThis is a test.';
      const markdownBase64 = btoa(markdownContent);
      const markdownDataUrl = `data:text/markdown;base64,${markdownBase64}`;
      const extractedMarkdown = simpleChatAgent['extractTextFromDataUrl'](markdownDataUrl);
      expect(extractedMarkdown).toBe(markdownContent);

      // Test with JavaScript data URL
      const jsContent = 'console.log("Hello");';
      const jsBase64 = btoa(jsContent);
      const jsDataUrl = `data:text/javascript;base64,${jsBase64}`;
      const extractedJs = simpleChatAgent['extractTextFromDataUrl'](jsDataUrl);
      expect(extractedJs).toBe(jsContent);

      // Test with non-text data URL (should return null)
      const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=';
      const extractedImage = simpleChatAgent['extractTextFromDataUrl'](imageDataUrl);
      expect(extractedImage).toBeNull();
    });
  });

  describe('Direct SimpleChatAgent Test', () => {
    it('should process text file attachments correctly when resolved', async () => {
      // Create a mock resolved message with text file attachment
      const resolvedMessage = {
        role: 'user',
        text: 'What number is in this file?',
        files: [
          {
            id: 'test-id',
            kind: 'text',
            name: 'test-number.txt',
            alt: 'Plain Text',
            dataUrl: 'data:text/plain;base64,ODg5OQ==', // "8899" in base64
            mimeType: 'text/plain',
            size: 4,
            width: 1,
            height: 4
          }
        ]
      };

      // Create a mock SimpleChatAgent
      const simpleChatAgent = new SimpleChatAgent({} as any, {} as any);

      // Test the text file filtering
      const attachments = resolvedMessage.files as any[];
      const textFiles = attachments.filter((a: any) => 
        a?.kind === 'text' && (a?.file?.tree && a?.file?.vertex || a?.dataUrl)
      );

      console.log('Direct test - text files found:', textFiles.length);
      expect(textFiles.length).toBe(1);

      // Test content extraction
      let extractedContent = '';
      for (const textFile of textFiles) {
        let fileContent: string | null = null;
        
        if (textFile.file?.tree && textFile.file?.vertex) {
          fileContent = await simpleChatAgent['loadTextFileContent'](textFile.file.tree, textFile.file.vertex);
        } else if (textFile.dataUrl) {
          fileContent = simpleChatAgent['extractTextFromDataUrl'](textFile.dataUrl);
        }
        
        if (fileContent) {
          const fileHeader = `\n\n--- File: ${textFile.name} (${textFile.alt || 'text'}) ---\n`;
          extractedContent += fileHeader + fileContent;
        }
      }

      console.log('Direct test - extracted content:', extractedContent);
      expect(extractedContent).toContain('8899');
      expect(extractedContent).toContain('test-number.txt');
    });

    it('should handle mixed text and image attachments', async () => {
      // Create a mock resolved message with both text and image attachments
      const resolvedMessage = {
        role: 'user',
        text: 'What do you see in these files?',
        files: [
          {
            id: 'text-id',
            kind: 'text',
            name: 'number.txt',
            alt: 'Plain Text',
            dataUrl: 'data:text/plain;base64,ODg5OQ==', // "8899" in base64
            mimeType: 'text/plain',
            size: 4,
            width: 1,
            height: 4
          },
          {
            id: 'image-id',
            kind: 'image',
            name: 'test.png',
            alt: 'Test image',
            dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=',
            mimeType: 'image/png',
            size: 68,
            width: 1,
            height: 1
          }
        ]
      };

      // Create a mock SimpleChatAgent
      const simpleChatAgent = new SimpleChatAgent({} as any, {} as any);

      // Test the filtering
      const attachments = resolvedMessage.files as any[];
      const images = attachments.filter((a: any) => a?.kind === 'image' && typeof a?.dataUrl === 'string' && a.dataUrl.trim() !== '');
      const textFiles = attachments.filter((a: any) => 
        a?.kind === 'text' && (a?.file?.tree && a?.file?.vertex || a?.dataUrl)
      );

      console.log('Mixed test - images:', images.length, 'text files:', textFiles.length);
      expect(images.length).toBe(1);
      expect(textFiles.length).toBe(1);

      // Test text content extraction
      let extractedContent = '';
      for (const textFile of textFiles) {
        let fileContent: string | null = null;
        
        if (textFile.file?.tree && textFile.file?.vertex) {
          fileContent = await simpleChatAgent['loadTextFileContent'](textFile.file.tree, textFile.file.vertex);
        } else if (textFile.dataUrl) {
          fileContent = simpleChatAgent['extractTextFromDataUrl'](textFile.dataUrl);
        }
        
        if (fileContent) {
          const fileHeader = `\n\n--- File: ${textFile.name} (${textFile.alt || 'text'}) ---\n`;
          extractedContent += fileHeader + fileContent;
        }
      }

      expect(extractedContent).toContain('8899');
      expect(extractedContent).toContain('number.txt');
    });
  });
});
