# Electron Custom File Protocol

This document describes Sila's custom `sila://` protocol implementation for serving files directly from Content-Addressed Storage (CAS) in Electron.

## Overview

The custom protocol allows Sila to serve files (images, PDFs, videos, etc.) directly from the file system without loading them into memory as data URLs. This provides:

- **Performance**: No memory overhead from base64 encoding
- **Scalability**: Large files don't cause stack overflows
- **Efficiency**: Direct file system access
- **Security**: Proper validation and access control

## Architecture

### URL Format
```
sila://spaces/{spaceId}/files/{hash}?type={mimeType}&name={fileName}
```

**Components:**
- `spaceId`: Unique identifier for the workspace
- `hash`: SHA256 hash of the file content
- `mimeType`: Optional MIME type for proper content-type headers
- `name`: Optional original filename used to hint downloads (set via `Content-Disposition`)

**Example:**
```
sila://spaces/f1ba226099084e4db17d1d3c27dcfc2a/files/c8670ca7ac518d8350206e897e61488210d3dcf963828ea8b90d23d3f8e04d08?type=image%2Fjpeg&name=photo.jpg
```

### File Path Resolution

Files are resolved using the CAS structure:
```
{spaceRoot}/space-v1/files/sha256/{hash[0:2]}/{hash[2:]}
```

**Example:**
- Hash: `c8670ca7ac518d8350206e897e61488210d3dcf963828ea8b90d23d3f8e04d08`
- Path: `/Users/dk/Documents/sila-spaces/test/space-v1/files/sha256/c8/670ca7ac518d8350206e897e61488210d3dcf963828ea8b90d23d3f8e04d08`

## Implementation

### 1. Main Process Setup

**File:** `packages/desktop/src-electron/main.js`

```javascript
// Setup custom file protocol (await modern async setup)
await setupFileProtocol();

// Setup IPC handlers for space management
setupSpaceManagementIPC();
```

### 2. Protocol Handler

**File:** `packages/desktop/src-electron/fileProtocol.js`

The protocol handler uses Electron's modern `protocol.handle()` API, and the modern `protocol.isProtocolHandled()` check (replacing deprecated `isProtocolRegistered`):

```javascript
protocol.handle('sila', async (request) => {
  // Parse URL and validate format
  // Look up space and construct file path
  // Read file and return Response
});
```

**Key Features:**
- URL validation and parsing
- Space lookup via SpaceManager
- File existence checking
- Proper MIME type handling
- Error responses with appropriate HTTP status codes

### 3. Space Management

**File:** `packages/desktop/src-electron/spaceManager.js`

Manages space registration and path resolution:

```javascript
class SpaceManager {
  registerSpace(spaceId, rootPath, name, createdAt)
  getSpaceRootPath(spaceId)
  unregisterSpace(spaceId)
  hasSpace(spaceId)
  getAllSpaces()
}
```

### 4. Inter-Process Communication (IPC)

**Files:** 
- `packages/desktop/src-electron/main.js` (IPC handlers)
- `packages/desktop/src-electron/fileSystemAPI.js` (Renderer API)

Since the protocol handler runs in the main process but spaces are loaded in the renderer process, IPC is used to register spaces:

```javascript
// Renderer → Main
ipcRenderer.invoke('register-space', { spaceId, rootPath, name, createdAt })

// Main process handler
ipcMain.handle('register-space', async (event, { spaceId, rootPath, name, createdAt }) => {
  spaceManager.registerSpace(spaceId, rootPath, name, createdAt);
});
```

### 5. Renderer Integration

**File:** `packages/client/src/lib/comps/apps/FilesApp.svelte`

The UI components use the protocol via the exposed API:

```javascript
function getFileUrl(file: Vertex): string {
  const spaceId = (data as any).space.getId();
  const hash = file.getProperty("hash") as string;
  const mimeType = file.getProperty("mimeType") as string;
  const name = file.getProperty("name") as string;
  
  if ((window as any).electronFileSystem) {
    return (window as any).electronFileSystem.getFileUrl(spaceId, hash, mimeType, name);
  }
  return "";
}
```

## Usage Examples

### Images
```html
<img src="sila://spaces/space-123/files/hash?type=image/jpeg&name=photo.jpg" alt="Image" />
```

### Videos
```html
<video src="sila://spaces/space-123/files/hash?type=video/mp4&name=clip.mp4" controls></video>
```

### PDFs
```html
<iframe src="sila://spaces/space-123/files/hash?type=application/pdf&name=document.pdf"></iframe>
```

## Error Handling

The protocol returns appropriate HTTP status codes:

- **400 Bad Request**: Invalid URL format or hash
- **404 Not Found**: Space or file not found
- **500 Internal Server Error**: File system errors

## Security Considerations

1. **Space Isolation**: Files are only accessible within their registered space
2. **Hash Validation**: Only valid SHA256 hashes are accepted
3. **Path Validation**: Prevents directory traversal attacks
4. **Access Control**: Files are only accessible to registered spaces

## Performance Benefits

### Before (Data URLs)
- Files loaded into memory as base64 strings
- Large files cause stack overflows
- Memory usage scales with file size
- Slow loading for large files

### After (Custom Protocol)
- Direct file system access
- No memory overhead
- Scalable to any file size
- Fast loading regardless of file size

## Streaming Support

The protocol supports HTTP range requests for efficient streaming of large files like videos:

### How It Works
1. **Browser Detection**: When using `<video>` or `<audio>` elements, browsers automatically send range requests
2. **Range Requests**: Browser requests specific byte ranges (e.g., `bytes=0-1023`)
3. **Chunked Response**: Protocol handler serves only the requested chunks
4. **Seekable Media**: Users can jump to any position in videos/audio

### Example
```html
<video src="sila://spaces/space-123/files/video-hash?type=video/mp4" controls />
```

The browser automatically sends requests like:
```
Range: bytes=0-1023
Range: bytes=1024-2047
Range: bytes=2048-3071
...
```

### Benefits
- **Memory Efficient**: Only requested chunks are loaded
- **Seekable**: Users can jump to any position
- **Progressive**: Media loads as needed
- **Bandwidth Optimized**: Only necessary data is transferred

## Debugging

### Main Process Logs
Look for logs in the Electron main process console:
```
Setting up sila file protocol...
Sila file protocol registered successfully
IPC: Registering space: space-123 /path/to/space
File protocol request: sila://spaces/space-123/files/hash
```

### Renderer Process Logs
Check the web console for:
```
Generated file URL: {spaceId, hash, mimeType, url}
Registering space: space-123 /path/to/space
```

## Future Enhancements

1. **Caching**: Browser-level caching for frequently accessed files
2. **Compression**: Automatic compression for supported file types
3. **Streaming**: Support for large video files
4. **Thumbnails**: Automatic thumbnail generation for images
5. **CDN Integration**: Support for external file storage

## Streaming Support for Large Files

For large files like videos, the current implementation loads the entire file into memory. To support streaming, we can enhance the protocol handler to:

### 1. Range Request Support

Handle HTTP `Range` headers for partial content requests:

```javascript
protocol.handle('sila', async (request) => {
  const range = request.headers.get('range');
  if (range) {
    // Parse range: bytes=0-1023
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = match[2] ? parseInt(match[2]) : null;
      return streamFileRange(filePath, start, end, mimeType);
    }
  }
  // Fall back to full file response
});
```

### 2. Streaming Implementation

```javascript
async function streamFileRange(filePath, start, end, mimeType) {
  const stat = await fs.stat(filePath);
  const fileSize = stat.size;
  
  const actualEnd = end || fileSize - 1;
  const contentLength = actualEnd - start + 1;
  
  const stream = fs.createReadStream(filePath, { start, end: actualEnd });
  
  const headers = {
    'Content-Range': `bytes ${start}-${actualEnd}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': contentLength.toString()
  };
  
  if (mimeType) {
    headers['Content-Type'] = mimeType;
  }
  
  return new Response(stream, { 
    status: 206, // Partial Content
    headers 
  });
}
```

### 3. Video-Specific Optimizations

For video files, we can add:

- **Chunked Transfer**: Stream in smaller chunks for better memory management
- **Adaptive Bitrate**: Serve different quality versions based on network conditions
- **Preload Hints**: Provide metadata for better buffering
- **Caching Headers**: Optimize caching for video content

### 4. Implementation Strategy

1. **Detect Large Files**: Use file size threshold (e.g., > 10MB)
2. **Check Range Headers**: Browser automatically sends range requests for videos
3. **Stream Response**: Use Node.js streams instead of loading entire file
4. **Memory Management**: Monitor memory usage and implement cleanup

### 5. Example Usage

```html
<!-- Browser automatically handles range requests for video streaming -->
<video src="sila://spaces/space-123/files/video-hash?type=video/mp4" controls>
  <source src="sila://spaces/space-123/files/video-hash?type=video/mp4" type="video/mp4">
</video>
```

The browser will automatically send range requests like:
```
Range: bytes=0-1023
Range: bytes=1024-2047
...
```

This enables:
- **Seekable Video**: Users can jump to any position
- **Progressive Loading**: Video loads as needed
- **Bandwidth Optimization**: Only requested chunks are transferred
- **Memory Efficiency**: No large file loading into memory

## Related Files

- `packages/desktop/src-electron/fileProtocol.js` - Protocol handler
- `packages/desktop/src-electron/spaceManager.js` - Space management
- `packages/desktop/src-electron/fileSystemAPI.js` - Renderer API
- `packages/desktop/src-electron/main.js` - Main process setup
- `packages/client/src/lib/comps/apps/FilesApp.svelte` - UI integration
- `packages/client/src/lib/state/clientState.svelte.ts` - Space registration
