import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  processTextFileForUpload, 
  optimizeTextFile, 
  isTextFile, 
  readFileSample, 
  isTextContent, 
  readFileAsText, 
  extractTextFileMetadata, 
  detectLanguage,
  type TextFileMetadata 
} from '@sila/client/utils/fileProcessing';

describe('Text File Attachments', () => {
  describe('isTextContent', () => {
    it('should detect text content correctly', () => {
      const textBytes = new TextEncoder().encode('Hello, world! This is a test file.');
      expect(isTextContent(textBytes)).toBe(true);
    });

    it('should detect binary content correctly', () => {
      // PNG signature
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(isTextContent(pngBytes)).toBe(false);
    });

    it('should detect null bytes as binary', () => {
      const bytesWithNull = new Uint8Array([72, 101, 108, 108, 111, 0, 119, 111, 114, 108, 100]); // "Hello\0world"
      expect(isTextContent(bytesWithNull)).toBe(false);
    });

    it('should handle UTF-8 content', () => {
      const utf8Bytes = new TextEncoder().encode('Hello 世界! 🌍');
      expect(isTextContent(utf8Bytes)).toBe(true);
    });

    it('should handle empty content', () => {
      expect(isTextContent(new Uint8Array())).toBe(true);
    });
  });

  describe('readFileSample', () => {
    it('should read file sample correctly', async () => {
      const content = 'Hello, world! This is a test file with some content.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const sample = await readFileSample(file, 20);
      const sampleText = new TextDecoder().decode(sample);
      
      expect(sampleText).toBe('Hello, world! This i');
      expect(sample.length).toBe(20);
    });

    it('should handle files smaller than maxBytes', async () => {
      const content = 'Short';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const sample = await readFileSample(file, 20);
      const sampleText = new TextDecoder().decode(sample);
      
      expect(sampleText).toBe('Short');
      expect(sample.length).toBe(5);
    });
  });

  describe('isTextFile', () => {
    it('should detect text files by MIME type', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      expect(await isTextFile(file)).toBe(true);
    });

    it('should detect JSON files', async () => {
      const file = new File(['{"key": "value"}'], 'test.json', { type: 'application/json' });
      expect(await isTextFile(file)).toBe(true);
    });

    it('should detect markdown files', async () => {
      const file = new File(['# Title\n\nContent'], 'test.md', { type: 'text/markdown' });
      expect(await isTextFile(file)).toBe(true);
    });

    it('should detect code files by extension', async () => {
      const file = new File(['function test() {}'], 'test.js', { type: 'application/octet-stream' });
      expect(await isTextFile(file)).toBe(true);
    });

    it('should reject image files', async () => {
      const file = new File(['fake image data'], 'test.png', { type: 'image/png' });
      expect(await isTextFile(file)).toBe(false);
    });

    it('should reject binary files with text extension', async () => {
      // Create a file with .txt extension but binary content
      const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const file = new File([binaryData], 'fake.txt', { type: 'text/plain' });
      expect(await isTextFile(file)).toBe(false);
    });
  });

  describe('readFileAsText', () => {
    it('should read text file content correctly', async () => {
      const content = 'Hello, world!\nThis is a test file.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const result = await readFileAsText(file);
      expect(result).toBe(content);
    });

    it('should handle UTF-8 content', async () => {
      const content = 'Hello 世界! 🌍\nTest content.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const result = await readFileAsText(file);
      expect(result).toBe(content);
    });
  });

  describe('extractTextFileMetadata', () => {
    it('should extract metadata correctly', () => {
      const content = 'Hello, world!\nThis is a test file.\nWith multiple lines.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const metadata = extractTextFileMetadata(file, content);
      
      expect(metadata.lineCount).toBe(3);
      expect(metadata.charCount).toBe(content.length);
      expect(metadata.wordCount).toBe(10); // "Hello,", "world!", "This", "is", "a", "test", "file.", "With", "multiple", "lines."
      expect(metadata.hasContent).toBe(true);
      expect(metadata.language).toBe('Plain Text');
      expect(metadata.encoding).toBe('utf-8');
    });

    it('should handle empty content', () => {
      const content = '';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const metadata = extractTextFileMetadata(file, content);
      
      expect(metadata.lineCount).toBe(1);
      expect(metadata.charCount).toBe(0);
      expect(metadata.wordCount).toBe(0);
      expect(metadata.hasContent).toBe(false);
    });

    it('should handle single line content', () => {
      const content = 'Single line content';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const metadata = extractTextFileMetadata(file, content);
      
      expect(metadata.lineCount).toBe(1);
      expect(metadata.charCount).toBe(19);
      expect(metadata.wordCount).toBe(3);
    });
  });

  describe('detectLanguage', () => {
    it('should detect JavaScript', () => {
      const result = detectLanguage('script.js', 'function test() {}');
      expect(result).toBe('JavaScript');
    });

    it('should detect TypeScript', () => {
      const result = detectLanguage('component.tsx', 'interface Props {}');
      expect(result).toBe('TypeScript');
    });

    it('should detect Python', () => {
      const result = detectLanguage('main.py', 'def hello(): pass');
      expect(result).toBe('Python');
    });

    it('should detect JSON', () => {
      const result = detectLanguage('config.json', '{"key": "value"}');
      expect(result).toBe('JSON');
    });

    it('should detect Markdown', () => {
      const result = detectLanguage('README.md', '# Title');
      expect(result).toBe('Markdown');
    });

    it('should return Unknown for unknown extensions', () => {
      const result = detectLanguage('file.xyz', 'content');
      expect(result).toBe('Unknown');
    });

    it('should handle files without extensions', () => {
      const result = detectLanguage('Dockerfile', 'FROM node:16');
      expect(result).toBe('Unknown');
    });
  });

  describe('processTextFileForUpload', () => {
    it('should process valid text files', async () => {
      const file = new File(['Hello, world!'], 'test.txt', { type: 'text/plain' });
      const result = await processTextFileForUpload(file);
      expect(result).toBe(file);
    });

    it('should reject non-text files', async () => {
      // Create a file with actual binary data (PNG signature)
      const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const file = new File([binaryData], 'test.bin', { type: 'application/octet-stream' });
      await expect(processTextFileForUpload(file)).rejects.toThrow('File does not appear to be a text file');
    });
  });

  describe('optimizeTextFile', () => {
    it('should return original file for text files', async () => {
      const file = new File(['Hello, world!'], 'test.txt', { type: 'text/plain' });
      const result = await optimizeTextFile(file);
      expect(result).toBe(file);
    });

    it('should return original file for non-text files', async () => {
      const file = new File(['binary data'], 'test.bin', { type: 'application/octet-stream' });
      const result = await optimizeTextFile(file);
      expect(result).toBe(file);
    });
  });

  describe('Integration tests', () => {
    it('should process a complete text file workflow', async () => {
      const content = `# Test File

This is a test markdown file.

## Features
- Feature 1
- Feature 2

\`\`\`javascript
function test() {
  console.log('Hello, world!');
}
\`\`\``;

      const file = new File([content], 'test.md', { type: 'text/markdown' });
      
      // Test the complete pipeline
      const isText = await isTextFile(file);
      expect(isText).toBe(true);
      
      const processed = await processTextFileForUpload(file);
      expect(processed).toBe(file);
      
      const optimized = await optimizeTextFile(processed);
      expect(optimized).toBe(file);
      
      const textContent = await readFileAsText(optimized);
      expect(textContent).toBe(content);
      
      const metadata = extractTextFileMetadata(optimized, textContent);
      expect(metadata.language).toBe('Markdown');
      expect(metadata.lineCount).toBeGreaterThan(10);
      expect(metadata.hasContent).toBe(true);
    });

    it('should handle various text file types', async () => {
      const testCases = [
        { name: 'script.js', content: 'console.log("Hello");', expectedLang: 'JavaScript' },
        { name: 'config.json', content: '{"key": "value"}', expectedLang: 'JSON' },
        { name: 'style.css', content: 'body { color: red; }', expectedLang: 'CSS' },
        { name: 'data.csv', content: 'name,age\nJohn,30', expectedLang: 'CSV' },
        { name: 'config.yaml', content: 'key: value', expectedLang: 'YAML' },
      ];

      for (const testCase of testCases) {
        const file = new File([testCase.content], testCase.name, { type: 'text/plain' });
        
        const isText = await isTextFile(file);
        expect(isText).toBe(true);
        
        const metadata = extractTextFileMetadata(file, testCase.content);
        expect(metadata.language).toBe(testCase.expectedLang);
      }
    });

    it('should reject binary files even with text extensions', async () => {
      // Create a PNG file with .txt extension
      const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const file = new File([pngSignature], 'fake.txt', { type: 'text/plain' });
      
      const isText = await isTextFile(file);
      expect(isText).toBe(false);
      
      await expect(processTextFileForUpload(file)).rejects.toThrow('File does not appear to be a text file');
    });
  });
});