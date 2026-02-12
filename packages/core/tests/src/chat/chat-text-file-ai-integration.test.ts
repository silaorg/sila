import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { Space, ChatAppData, FileSystemPersistenceLayer, SpaceManager, AgentServices, WrapChatAgent } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ThreadMessage } from '@sila/core';
import { convertToLangMessage } from '../../../src/agents/convertToLangMessage';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toBase64 = (value: string) => Buffer.from(value, 'utf-8').toString('base64');

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
    const manager = new SpaceManager({
      setupSyncLayers: () => [layer],
      setupFileLayer: () => layer
    });
    await manager.addSpace(space, spaceId);
  });

  const createAgent = () => new WrapChatAgent(chatData, new AgentServices(space), chatTree);

  const createTextAttachment = (name: string, content: string, mimeType = 'text/plain') => ({
    id: crypto.randomUUID(),
    kind: 'text' as const,
    name,
    mimeType,
    size: content.length,
    content,
    metadata: {
      lineCount: content.split('\n').length,
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      hasContent: true,
      language: mimeType === 'text/markdown' ? 'Markdown' : 'Plain Text',
      encoding: 'utf-8'
    },
    width: content.split('\n').length,
    height: content.length,
    alt: mimeType === 'text/markdown' ? 'Markdown' : 'Plain Text'
  });

  const toText = (langMessage: any): string => {
    if (typeof langMessage.text === 'string') {
      return langMessage.text;
    }
    if (Array.isArray(langMessage.items)) {
      return langMessage.items
        .filter((item: any) => item?.type === 'text')
        .map((item: any) => item.text)
        .join('\n');
    }
    return '';
  };

  const convert = async (message: ThreadMessage, supportsVision = true) =>
    convertToLangMessage({
      message,
      data: chatData,
      fileResolver: space.fileResolver,
      supportsVision,
    });

  describe('WrapChatAgent file-aware conversions', () => {
    it('embeds persisted text attachment content into LangMessage text', async () => {
      const attachment = createTextAttachment('test-number.txt', '8899');
      const message = await chatData.newMessage({ role: 'user', text: 'What number is in this file?', attachments: [attachment] });
      await wait(800);

      const langMessage = await convert(message);
      const content = toText(langMessage);

      expect(content).toContain('What number is in this file?');
      expect(content).toContain('<attachments>');
      expect(content).toContain('The user attached 1 file');
      expect(content).toContain('- test-number.txt (text)');
      expect(content).toContain('path: file:assets/test-number.txt');
      expect(content).toContain('--- File: test-number.txt (text) ---');
      expect(content).toContain('Characters shown: 4 of 4');
      expect(content).toContain('8899');
    });

    it('preserves markdown structure when embedding text attachments', async () => {
      const markdown = `# Test File

This is a test markdown file.

## Number
The number is: **8899**

## Code
\`\`\`javascript
function test() {
  return 8899;
}
\`\`\``;
      const attachment = createTextAttachment('test.md', markdown, 'text/markdown');
      const message = await chatData.newMessage({ role: 'user', text: 'Please summarize this markdown', attachments: [attachment] });
      await wait(800);

      const langMessage = await convert(message);
      const content = toText(langMessage);

      expect(content).toContain('--- File: test.md (text) ---');
      expect(content).toContain('Path: file:assets/test.md');
      expect(content).toContain('# Test File');
      expect(content).toContain('**8899**');
    });

    it('aggregates multiple text files into a single contextual block', async () => {
      const attachment1 = createTextAttachment('number.txt', '8899');
      const attachment2 = createTextAttachment('greeting.txt', 'Hello World');
      const message = await chatData.newMessage({
        role: 'user',
        text: 'Process both files please',
        attachments: [attachment1, attachment2]
      });
      await wait(800);

      const langMessage = await convert(message);
      const content = toText(langMessage);

      expect(content).toContain('--- File: number.txt (text) ---');
      expect(content).toContain('Path: file:assets/number.txt');
      expect(content).toContain('--- File: greeting.txt (text) ---');
      expect(content).toContain('Path: file:assets/greeting.txt');
      expect(content).toContain('8899');
      expect(content).toContain('Hello World');
    });

    it('extracts inline data URLs without hitting CAS', () => {
      const agent = createAgent();
      const extract = (dataUrl: string) => agent['extractTextFromDataUrl'](dataUrl);

      expect(extract('data:text/plain;base64,ODg5OQ==')).toBe('8899');
      const markdownContent = '# Test\nThis is a test.';
      expect(extract(`data:text/markdown;base64,${toBase64(markdownContent)}`)).toBe(markdownContent);
      expect(extract('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=')).toBeNull();
    });

    it('includes multimodal items when images are present and vision is supported', async () => {
      const textAttachment = createTextAttachment('notes.txt', '8899');
      const imageAttachment = {
        id: crypto.randomUUID(),
        kind: 'image' as const,
        name: 'cat.png',
        mimeType: 'image/png',
        size: 68,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=',
        width: 1,
        height: 1,
        alt: 'Test image'
      };

      const message = await chatData.newMessage({
        role: 'user',
        text: 'What do you see?',
        attachments: [textAttachment, imageAttachment]
      });
      await wait(800);

      const langMessage = await convert(message, true);
      const items = (langMessage as any).items;

      expect(Array.isArray(items)).toBe(true);
      expect(items.some((item: any) => item?.type === 'image')).toBe(true);
      expect(items.filter((item: any) => item?.type === 'text').map((item: any) => item.text).join('\n')).toContain('Path: file:assets/notes.txt');
    });

    it('falls back to textual description for image attachments when vision is disabled', async () => {
      const imageAttachment = {
        id: crypto.randomUUID(),
        kind: 'image' as const,
        name: 'diagram.png',
        mimeType: 'image/png',
        size: 68,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=',
        width: 1,
        height: 1,
        alt: 'Diagram'
      };

      const message = await chatData.newMessage({
        role: 'user',
        text: 'Describe this diagram',
        attachments: [imageAttachment]
      });
      await wait(800);

      const langMessage = await convert(message, false);
      const content = toText(langMessage);

      expect(content).toContain('<attachments>');
      expect(content).toContain('The user attached 1 file');
      expect(content).toContain('- diagram.png (image)');
      expect(content).toContain('path: file:assets/diagram.png');
    });
  });
});
