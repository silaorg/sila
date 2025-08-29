# Clipboard Paste Support for Files

This document describes the clipboard paste functionality implemented in the SendMessageForm component, allowing users to paste files directly into the chat input area.

## Overview

The SendMessageForm component now supports pasting files from the clipboard, providing a convenient way to attach files without using the file picker dialog. This feature works with both file objects and image data from the clipboard.

## Supported Paste Types

### 1. File Objects
- **Text Files**: `.txt`, `.md`, `.json`, `.csv`, `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.cs`, `.php`, `.rb`, `.go`, `.rs`, `.swift`, `.kt`, `.scala`, `.sh`, `.bat`, `.ps1`, `.yml`, `.yaml`, `.toml`, `.ini`, `.cfg`, `.conf`, `.xml`, `.html`, `.css`, `.log`, `.tsv`
- **Image Files**: JPEG, PNG, GIF, WebP, SVG, AVIF, HEIC (converted to JPEG)

### 2. Image Data
- **Screenshots**: Images copied from screenshot tools
- **Clipboard Images**: Images copied from other applications
- **Web Images**: Images copied from web browsers

## Implementation Details

### Event Handler
The paste functionality is implemented in the `handlePaste` function in `SendMessageForm.svelte`:

```typescript
async function handlePaste(e: ClipboardEvent) {
  if (!attachEnabled || disabled) {
    return;
  }

  const clipboardData = e.clipboardData;
  if (!clipboardData) {
    return;
  }

  let hasProcessedContent = false;

  // Process file objects
  const files = Array.from(clipboardData.files || []);
  if (files.length > 0) {
    hasProcessedContent = true;
    
    for (const file of files) {
      const processingId = crypto.randomUUID();
      
      // Add processing indicator immediately
      attachments = [...attachments, {
        id: processingId,
        kind: isText ? 'text' : 'image',
        name: file.name,
        mimeType: file.type,
        size: file.size,
        isLoading: true
      }];

      try {
        // Process file through pipeline...
        // Replace processing indicator with completed attachment
        attachments = attachments.map(att => 
          att.id === processingId 
            ? {
                id: processingId,
                kind: 'text',
                name: optimizedFile.name,
                mimeType: optimizedFile.type,
                size: optimizedFile.size,
                content,
                metadata,
                width: metadata.charCount,
                height: metadata.lineCount,
                alt: metadata.language,
                isLoading: false
              }
            : att
        );
      } catch (error) {
        // Remove processing indicator on error
        attachments = attachments.filter(a => a.id !== processingId);
      }
    }
  }

  // Prevent default paste behavior if we processed any files or images
  if (hasProcessedContent) {
    e.preventDefault();
  }
}
```

### File Processing Pipeline

Pasted files go through the same processing pipeline as files selected via the file picker:

1. **Text File Detection**: Content-based detection using binary signature analysis
2. **HEIC Conversion**: iPhone HEIC files automatically converted to JPEG
3. **Image Optimization**: Images larger than 2048x2048 pixels are resized
4. **Quality Optimization**: JPEG quality set to 85% for good size/quality balance
5. **Metadata Extraction**: File metadata (dimensions, language, line count, etc.)

### Integration with Existing System

- **AttachmentPreview Creation**: Pasted files create the same `AttachmentPreview` objects as file picker selections
- **CAS Storage**: Files are stored in Content-Addressed Storage when messages are sent
- **AI Integration**: File content is automatically included in AI conversations
- **UI Consistency**: Pasted files appear in the same attachment preview area

## User Experience

### Visual Feedback
- **Immediate Feedback**: Processing indicators appear instantly when files are pasted
- **Loading States**: Files show "Processing..." with spinning loader while being optimized
- **Smooth Transitions**: Processing indicators are replaced with actual attachments when ready
- **Text Files**: Show metadata (language, line count, word count) when processing completes
- **Image Files**: Show thumbnail previews when processing completes
- **Files can be removed**: Using the × button during processing or after completion

### User Guidance
- The attachment button tooltip now includes "💡 You can also paste files directly into the text area"
- Users can paste files by focusing the textarea and using Cmd+V (macOS) or Ctrl+V (Windows/Linux)

### Error Handling
- Failed file processing is logged to console but doesn't break the paste operation
- Unsupported file types are silently ignored
- Text paste behavior is preserved when no files are detected

## Browser Compatibility

### Supported Browsers
- **Chrome/Edge**: Full support for file objects and image data
- **Firefox**: Full support for file objects and image data
- **Safari**: Full support for file objects and image data

### Limitations
- Some older browsers may not support `clipboardData.files`
- Image data paste support varies by browser version
- Mobile browsers may have limited clipboard access

## Testing

### Manual Testing Scenarios
1. **File Paste**: Copy a file from Finder/Explorer and paste into textarea
2. **Screenshot Paste**: Take a screenshot and paste into textarea
3. **Web Image Paste**: Copy an image from a web page and paste into textarea
4. **Text File Paste**: Copy a text file and paste into textarea
5. **Mixed Content**: Paste text and files together
6. **Error Cases**: Try pasting unsupported file types

### Expected Behavior
- Files should appear as attachments immediately after pasting
- Text content should be preserved when no files are detected
- File processing errors should be logged but not break the interface
- Attachment previews should be removable

## Future Enhancements

### Potential Improvements
- **Drag and Drop**: Support for dragging files directly into the textarea
- **Multiple File Types**: Support for more file types (PDF, video, audio)
- **Paste Progress**: Visual indicator for large file processing
- **Paste History**: Remember recently pasted files for quick re-attachment
- **Batch Processing**: Optimize processing of multiple pasted files

### Performance Considerations
- **Async Processing**: File processing is already asynchronous to prevent UI blocking
- **Memory Management**: Large files are processed in chunks to avoid memory issues
- **Caching**: Consider caching processed file metadata for repeated pastes

## Related Components

- **SendMessageForm.svelte**: Main component with paste functionality
- **fileProcessing.ts**: File processing utilities used by paste handler
- **ChatAppData.ts**: Handles attachment persistence and AI integration
- **FilePreview.svelte**: Displays attachment previews

## Conclusion

The clipboard paste functionality provides a seamless way for users to attach files to their messages, improving the overall user experience by reducing the need to use file picker dialogs. The implementation follows Sila's existing file processing patterns and integrates smoothly with the current attachment system.
