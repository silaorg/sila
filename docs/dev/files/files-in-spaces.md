# Files in Spaces

This document describes how Sila handles file storage, organization, and serving across the application. Files are stored using Content-Addressed Storage (CAS) and referenced through a logical file system structure.

## Overview

Sila's file system provides:
- **Content-Addressed Storage (CAS)**: Files stored by SHA-256 hash for deduplication
- **Logical Organization**: Files organized in a Files AppTree with folders and metadata
- **Reference-Based Access**: Messages reference files by tree/vertex IDs, not embedded content
- **Direct File Serving**: Files served via custom `sila://` protocol
- **AI Integration**: File content automatically included in AI conversations

## Architecture

### Content-Addressed Storage (CAS)

Files are stored on disk using their SHA-256 hash as the address:

```
<spaceRoot>/
  space-v1/
    ops/                 # CRDT ops (jsonl)
    files/
      sha256/
        ab/
          cdef...89      # full hash split as 2+rest, binary content
    secrets              # encrypted secrets
    space.json           # metadata with space id
```

- **Path Structure**: `space-v1/files/sha256/<hash[0..1]>/<hash[2..]>`
- **Deduplication**: Identical files map to the same path automatically
- **Hash Collision**: SHA-256 provides excellent collision resistance for practical use

### Files AppTree (Logical Organization)

A dedicated app tree provides a browsable logical view of files:

```typescript
// Folder vertex properties
{
  _n: "folder",
  name: string,
  createdAt: number
}

// File vertex properties  
{
  _n: "file",
  name: string,
  hash: string,           // SHA-256 hash
  mimeType?: string,
  size?: number,
  width?: number,         // For images
  height?: number,        // For images
  alt?: string,           // Accessibility text
  tags?: string[],
  createdAt: number,
  
  // Conversion metadata (for processed files)
  originalFormat?: string,
  conversionQuality?: number,
  originalDimensions?: string,
  originalFilename?: string
}
```

### File References

Messages store lightweight references to files:

```typescript
interface FileReference {
  tree: string;    // Files AppTree ID
  vertex: string;  // File vertex ID within the tree
}

// File structure
{
  id: string;
  kind: 'image' | 'text' | 'video' | 'pdf' | 'file';
  file: FileReference;
  alt?: string;    // Optional accessibility text
}
```

## File Processing Pipeline

### Image Processing

1. **HEIC Conversion**: iPhone HEIC files automatically converted to JPEG
2. **Size Optimization**: Images larger than 2048x2048 pixels are resized
3. **Quality Optimization**: JPEG quality set to 85% for good size/quality balance
4. **Metadata Preservation**: Original format, dimensions, and filename tracked

### Text File Processing

1. **Content-Based Detection**: Files validated as text using content analysis
2. **Binary Signature Detection**: Common binary formats (JPEG, PNG, ZIP) rejected
3. **Language Detection**: Programming language identified from file extension
4. **Metadata Extraction**: Line count, character count, word count calculated

### Supported File Types

**Images**: JPEG, PNG, GIF, WebP, SVG, AVIF, HEIC (converted to JPEG)

**Text Files**: 
- Plain text: `.txt`, `.log`, `.csv`
- Markup: `.md`, `.html`, `.css`
- Code: `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.cs`, `.php`, `.rb`, `.go`, `.rs`, `.swift`, `.kt`, `.scala`
- Data: `.json`, `.xml`, `.yaml`, `.toml`, `.ini`
- Scripts: `.sh`, `.bash`, `.bat`, `.ps1`

**Other**: PDF, video files (MP4, WebM, OGG), audio files

## File Storage and Retrieval

### FileStore API

```typescript
interface FileStore {
  putDataUrl(dataUrl: string): Promise<{ hash: string; mimeType?: string; size: number }>;
  putBytes(bytes: Uint8Array, mimeType?: string): Promise<{ hash: string; size: number }>;
  exists(hash: string): Promise<boolean>;
  getBytes(hash: string): Promise<Uint8Array>;
  getDataUrl(hash: string): Promise<string>;
  delete(hash: string): Promise<void>; // No-op in current implementation
}
```

### FilesTreeData API

```typescript
// Create new Files AppTree
FilesTreeData.createNewFilesTree(space)

// Get or create default Files AppTree
FilesTreeData.getOrCreateDefaultFilesTree(space)

// Ensure folder path exists
FilesTreeData.ensureFolderPath(filesTree, ['YYYY', 'MM', 'DD'])

// Create a file vertex under a folder
FilesTreeData.saveFileInfo(folder, {
  name,
  hash,
  mimeType,
  size,
  width,
  height,
})

// Or from an AttachmentPreview
FilesTreeData.saveFileInfoFromAttachment(folder, attachment, hash)
```

## File Serving

### Custom Protocol

Files are served via the `sila://` protocol:

```
sila://spaces/{spaceId}/files/{hash}?type={mimeType}&name={fileName}
```

**Components:**
- `spaceId`: Workspace identifier
- `hash`: SHA-256 hash of file content
- `mimeType`: Content type for proper headers
- `name`: Original filename for downloads

### Electron Implementation

The protocol handler in Electron:
1. Validates the URL format and hash
2. Resolves the file path from CAS structure
3. Serves the file with proper content-type headers
4. Supports range requests for large files
5. Handles download requests with Content-Disposition

## File Resolution

### Client-Side Resolution

```typescript
// Resolve file reference to metadata and URL
const fileInfo = await ClientFileResolver.resolveFileReference(fileRef);

// Result includes:
{
  id: string,
  name: string,
  mimeType?: string,
  size?: number,
  width?: number,
  height?: number,
  url: string,        // sila:// URL
  hash: string
}
```

### Server-Side Resolution

For AI processing, files are resolved to data URLs:

```typescript
// Resolve files for AI consumption
const resolvedFiles = await fileResolver.resolveFiles(files);

// Result includes data URLs for AI models
{
  id: string,
  kind: string,
  name?: string,
  alt?: string,
  dataUrl: string,    // Base64 encoded data
  mimeType?: string,
  size?: number,
  width?: number,
  height?: number
}
```

## AI Integration

### Vision-Capable Models

For models that support vision (OpenAI, Anthropic, Google, etc.):

1. **Images**: Sent as base64-encoded image parts
2. **Text Files**: Content extracted and sent as text parts
3. **Mixed Content**: Both images and text files in single message

### Text-Only Models

For models without vision capabilities:

1. **Images**: Descriptive text added (e.g., "[User attached 2 image(s): photo1.jpg, photo2.png]")
2. **Text Files**: Content extracted and appended to message text with file headers
3. **File Metadata**: Language, line count, and other metadata included

### Text File Content Loading

Text file content is loaded from CAS when needed:

```typescript
// Load text content from CAS
const fileContent = await loadTextFileContent(treeId, vertexId);

// Extract text from data URL (fallback)
const textContent = extractTextFromDataUrl(dataUrl);
```

## File Preview System

### Components

- **FilePreview.svelte**: Main component that resolves file references
- **ImageFilePreview.svelte**: Renders image previews with hover effects
- **RegularFilePreview.svelte**: Renders file tiles with icons and metadata
- **FileGalleryModal.svelte**: Full-screen file viewer with navigation

### Preview Types

```typescript
interface FilePreviewConfig {
  canPreview: boolean;
  previewType: 'image' | 'video' | 'pdf' | 'text' | 'file';
  gallerySupport: boolean;
  supportedFormats: string[];
  displayName: string;
  icon: string;
}
```

### Gallery System

- **Single File View**: Current implementation focuses on single file viewing
- **Navigation**: Future support for multiple files with next/previous
- **Download**: Files can be downloaded from gallery view
- **Keyboard Support**: ESC to close, arrow keys for navigation (future)

## Data Flow

### File Upload

1. **File Selection**: User selects files in message form
2. **Processing**: Files go through conversion pipeline (HEIC, optimization)
3. **CAS Storage**: Processed files stored in CAS via FileStore
4. **Metadata Creation**: File vertices created in Files AppTree
5. **Reference Creation**: Message files reference file vertices
6. **Transient Data**: Data URLs stored temporarily for immediate preview

### File Display

1. **Reference Resolution**: FilePreview resolves tree/vertex to metadata
2. **URL Generation**: `sila://` URL generated for file access
3. **Preview Rendering**: Appropriate preview component renders file
4. **Gallery Integration**: Click opens file in gallery modal

### AI Processing

1. **File Resolution**: FileResolver loads file content from CAS
2. **Content Extraction**: Text files decoded, images converted to base64
3. **Message Construction**: Content added to AI message in appropriate format
4. **Model Dispatch**: Message sent to AI model with file content

## Platform Support

### Desktop (Electron)

- **Full CAS Support**: Complete file storage and retrieval
- **Custom Protocol**: `sila://` protocol for file serving
- **File System Access**: Direct access to workspace directories
- **Native Dialogs**: File picker and save dialogs

### Web (Future)

- **IndexedDB Storage**: Blob storage for web environments
- **Data URL Fallback**: Files served as data URLs
- **Limited Features**: Some features may be restricted

### Mobile (Capacitor)

- **File System Access**: Native file system integration
- **Camera Integration**: Direct photo capture
- **Share Support**: Native sharing capabilities

## Performance Considerations

### Memory Management

- **Lazy Loading**: File metadata loaded only when needed
- **Caching**: Resolved file info cached in client state
- **Streaming**: Large files served via streaming (range requests)

### Network Optimization

- **Reference-Based**: Only file references sent in messages
- **Deduplication**: Identical files stored once
- **Compression**: Images optimized for size/quality balance

### Storage Efficiency

- **Content Addressing**: Automatic deduplication by hash
- **Metadata Separation**: File metadata separate from content
- **Garbage Collection**: Future support for unreferenced file cleanup

## Security

### File Validation

- **Content-Based Detection**: Files validated by content, not just extension
- **Binary Signature Checking**: Common binary formats detected and rejected
- **Size Limits**: Large files may be truncated or rejected

### Access Control

- **Space Isolation**: Files isolated by workspace
- **Hash Validation**: File integrity verified by SHA-256
- **Protocol Security**: Custom protocol validates all requests

## Future Enhancements

### Planned Features

- **File Search**: Search within file content and metadata
- **File Sharing**: Share files between workspaces
- **Version Control**: File versioning and history
- **Advanced Gallery**: Multi-file navigation and zoom controls
- **Thumbnail Generation**: Automatic thumbnail creation for images

### Performance Improvements

- **Background Processing**: File processing in background threads
- **Progressive Loading**: Low-res previews before full resolution
- **Smart Caching**: Intelligent cache invalidation and prefetching

## Testing

### Test Coverage

- **Unit Tests**: File processing functions, content detection
- **Integration Tests**: Complete workflow from upload to AI processing
- **Performance Tests**: Memory usage, loading times, file size limits
- **Edge Cases**: Binary files with text extensions, empty files, large files

### Test Assets

Test files stored in `packages/tests/assets/`:
- **Images**: Various formats for testing image processing
- **Text Files**: Different languages and formats
- **Binary Files**: For testing rejection logic

## Conclusion

Sila's file system provides a robust, scalable foundation for file handling across the application. The combination of CAS storage, logical organization, and reference-based access ensures efficient file management while maintaining excellent user experience and AI integration capabilities.