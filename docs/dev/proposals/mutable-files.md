# Proposal: Mutable Files System for Sila

## Motivation

Sila's current Content-Addressed Storage (CAS) system provides excellent deduplication and integrity guarantees for immutable files, but some use cases require mutable file storage where content can be updated, rotated, or overwritten. Examples include:

- **Encrypted secret bundles**: API keys and credentials that need periodic rotation
- **Thumbnail caches**: Generated previews that may be regenerated with different quality settings
- **Temporary data**: Session data, drafts, or intermediate processing results
- **Configuration files**: App settings that users can modify
- **User avatars**: Profile pictures that can be updated
- **App state snapshots**: Periodic backups of application state

This proposal extends Sila's file storage system to support both immutable (CAS) and mutable (UUID-addressed) files while maintaining the existing architecture and providing a unified interface for apps to reference both types.

## Current System Analysis

### Content-Addressed Storage (CAS)

Sila currently stores files using SHA-256 hashes in a content-addressed structure:

```
space-v1/
  files/
    sha256/{hash[0:2]}/{hash[2:]}     # existing CAS structure
```

**Characteristics:**
- **Immutable**: Files cannot be modified once stored
- **Deduplicated**: Identical content maps to the same hash
- **Integrity**: SHA-256 provides strong collision resistance
- **Referenced by**: SHA-256 hash in file vertices
- **URL format**: `sila://spaces/{spaceId}/files/{hash}?type={mimeType}`

### File References

Apps reference files through a two-level system:

1. **FileReference**: `{ tree: string, vertex: string }` - points to a file vertex in a Files AppTree
2. **File Vertex**: Contains metadata including `hash` property that points to CAS storage

```typescript
interface FileReference {
  tree: string;    // Files AppTree ID
  vertex: string;  // File vertex ID within the tree
}

// File vertex properties
{
  _n: "file",
  name: string,
  hash: string,           // SHA-256 hash for CAS lookup
  mimeType?: string,
  size?: number,
  // ... other metadata
}
```

## Proposed Mutable Files System

### Storage Structure

Extend the file storage to support both immutable and mutable blobs:

```
space-v1/
  files/
    sha256/{hash[0:2]}/{hash[2:]}     # existing CAS structure
    mutable/uuid/{uuid}               # new mutable storage
```

**Mutable Storage Characteristics:**
- **UUID-addressed**: Files identified by UUID instead of content hash
- **Mutable**: Content can be updated, overwritten, or deleted
- **Not deduplicated**: Each UUID maps to unique content
- **Referenced by**: UUID in file vertices
- **URL format**: `sila://spaces/{spaceId}/files/mutable/{uuid}?type={mimeType}`

### FileStore Interface Extension

Extend the existing `FileStore` interface to support mutable operations:

```typescript
interface FileStore {
  // Existing CAS methods (unchanged)
  putDataUrl(dataUrl: string): Promise<{ hash: string; size: number }>;
  putBytes(bytes: Uint8Array): Promise<{ hash: string; size: number }>;
  exists(hash: string): Promise<boolean>;
  getBytes(hash: string): Promise<Uint8Array>;
  getDataUrl(hash: string): Promise<string>;
  delete(hash: string): Promise<void>;
  
  // New mutable storage methods
  putMutable(uuid: string, bytes: Uint8Array): Promise<void>;
  putMutableDataUrl(uuid: string, dataUrl: string): Promise<void>;
  getMutable(uuid: string): Promise<Uint8Array>;
  getMutableDataUrl(uuid: string): Promise<string>;
  existsMutable(uuid: string): Promise<boolean>;
  deleteMutable(uuid: string): Promise<void>;
  
  // Utility methods
  generateMutableUuid(): string;
}
```

### File Vertex Schema Extension

Extend file vertices to support both immutable and mutable files:

```typescript
// Immutable file vertex (existing)
{
  _n: "file",
  name: string,
  hash: string,           // SHA-256 hash for CAS lookup
  mimeType?: string,
  size?: number,
  // ... other metadata
}

// Mutable file vertex (new)
{
  _n: "file",
  name: string,
  uuid: string,           // UUID for mutable storage lookup
  mutable: true,          // flag indicating mutable file
  mimeType?: string,
  size?: number,
  // ... other metadata
}
```

### File Reference Resolution

The existing `FileResolver` class will be extended to handle both file types:

```typescript
class FileResolver {
  async resolveFileReference(fileRef: FileReference): Promise<ResolvedFileInfo | null> {
    const fileVertex = await this.getFileVertex(fileRef);
    if (!fileVertex) return null;
    
    // Check if file is mutable
    const isMutable = fileVertex.getProperty('mutable') === true;
    
    if (isMutable) {
      const uuid = fileVertex.getProperty('uuid') as string;
      const url = `sila://spaces/${spaceId}/files/mutable/${uuid}${query}`;
      return {
        id: fileRef.vertex,
        name: fileVertex.name || 'Unknown file',
        mimeType: fileVertex.getProperty('mimeType'),
        size: fileVertex.getProperty('size'),
        url,
        uuid, // Include UUID for mutable files
        mutable: true
      };
    } else {
      // Existing immutable file resolution
      const hash = fileVertex.getProperty('hash') as string;
      const url = `sila://spaces/${spaceId}/files/${hash}${query}`;
      return {
        id: fileRef.vertex,
        name: fileVertex.name || 'Unknown file',
        mimeType: fileVertex.getProperty('mimeType'),
        size: fileVertex.getProperty('size'),
        url,
        hash, // Include hash for immutable files
        mutable: false
      };
    }
  }
}
```

### Protocol Handler Extension

Extend the `sila://` protocol handler to support mutable files:

```javascript
// In fileProtocol.js
protocol.handle('sila', async (request) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Handle mutable files: /{spaceId}/files/mutable/{uuid}
  if (pathParts.length === 4 && pathParts[1] === 'files' && pathParts[2] === 'mutable') {
    const spaceId = pathParts[0];
    const uuid = pathParts[3];
    
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      return new Response('Invalid UUID format', { status: 400 });
    }
    
    const filePath = makeMutablePath(spaceRoot, uuid);
    // ... rest of file serving logic
  }
  
  // Handle immutable files: /{spaceId}/files/{hash} (existing)
  // ... existing logic
});

function makeMutablePath(spaceRoot, uuid) {
  return path.join(spaceRoot, 'space-v1', 'files', 'mutable', 'uuid', uuid);
}
```

## Implementation Strategy

### Phase 1: Core Infrastructure

1. **FileStore Extension**
   - Add mutable storage methods to `FileStore` interface
   - Implement `FileSystemFileStore` mutable operations
   - Add UUID generation utilities

2. **Storage Layer**
   - Create `mutable/uuid/` directory structure
   - Implement file operations for mutable storage
   - Add proper error handling and validation

3. **Protocol Handler**
   - Extend `sila://` protocol to handle mutable URLs
   - Add UUID validation and path resolution
   - Maintain backward compatibility with existing hash-based URLs

### Phase 2: File System Integration

1. **FileResolver Extension**
   - Add mutable file detection and resolution
   - Extend `ResolvedFileInfo` interface to include mutable flag
   - Update file reference resolution logic

2. **File Vertex Schema**
   - Add support for `uuid` and `mutable` properties
   - Update file creation utilities to handle both types
   - Maintain backward compatibility with existing hash-based files

3. **FilesTreeData Updates**
   - Add methods for creating mutable file vertices
   - Update file metadata handling
   - Add utilities for converting between mutable and immutable files

### Phase 3: App Integration

1. **Chat App Integration**
   - Update message attachment handling to support mutable files
   - Add UI for managing mutable file references
   - Ensure AI integration works with both file types

2. **Files App Integration**
   - Add UI indicators for mutable vs immutable files
   - Support editing mutable file content
   - Add file type conversion utilities

3. **Secrets App Integration**
   - Implement encrypted secret bundles using mutable storage
   - Add secret rotation and management features
   - Integrate with existing secrets system

## Use Cases and Examples

### 1. Encrypted Secret Bundles

```typescript
class SecretsTree {
  async setSecret(key: string, value: string): Promise<void> {
    const uuid = this.fileStore.generateMutableUuid();
    const encrypted = await this.encrypt(value);
    
    // Store encrypted data in mutable storage
    await this.fileStore.putMutable(uuid, new TextEncoder().encode(encrypted));
    
    // Create mutable file vertex
    const secretVertex = this.appTree.tree.newNamedVertex(secretsVertex.id, 'secret', {
      key: key,
      uuid: uuid,
      mutable: true,
      mimeType: 'application/octet-stream'
    });
  }
  
  async rotateSecret(key: string, newValue: string): Promise<void> {
    const secretVertex = this.findSecretVertex(key);
    const uuid = secretVertex.getProperty('uuid') as string;
    
    // Update content in mutable storage
    const encrypted = await this.encrypt(newValue);
    await this.fileStore.putMutable(uuid, new TextEncoder().encode(encrypted));
    
    // Update metadata
    secretVertex.setProperty('lastRotated', Date.now());
  }
}
```

### 2. Thumbnail Caches

```typescript
class ThumbnailManager {
  async generateThumbnail(imageHash: string, size: number): Promise<string> {
    const uuid = this.fileStore.generateMutableUuid();
    
    // Generate thumbnail
    const thumbnailBytes = await this.createThumbnail(imageHash, size);
    
    // Store in mutable storage
    await this.fileStore.putMutable(uuid, thumbnailBytes);
    
    // Create mutable file vertex
    const thumbnailVertex = this.filesTree.tree.newNamedVertex(thumbnailsVertex.id, 'thumbnail', {
      name: `thumb_${size}x${size}.jpg`,
      uuid: uuid,
      mutable: true,
      mimeType: 'image/jpeg',
      size: thumbnailBytes.length,
      originalHash: imageHash,
      thumbnailSize: size
    });
    
    return uuid;
  }
  
  async updateThumbnailQuality(uuid: string, newQuality: number): Promise<void> {
    const thumbnailVertex = this.findThumbnailVertex(uuid);
    const originalHash = thumbnailVertex.getProperty('originalHash') as string;
    
    // Regenerate with new quality
    const newThumbnailBytes = await this.createThumbnail(originalHash, newQuality);
    
    // Update mutable storage
    await this.fileStore.putMutable(uuid, newThumbnailBytes);
    
    // Update metadata
    thumbnailVertex.setProperty('quality', newQuality);
    thumbnailVertex.setProperty('size', newThumbnailBytes.length);
  }
}
```

### 3. User Avatars

```typescript
class UserProfileManager {
  async updateAvatar(userId: string, imageData: Uint8Array): Promise<void> {
    const uuid = this.fileStore.generateMutableUuid();
    
    // Store new avatar in mutable storage
    await this.fileStore.putMutable(uuid, imageData);
    
    // Update or create avatar file vertex
    let avatarVertex = this.findAvatarVertex(userId);
    if (avatarVertex) {
      // Update existing avatar
      const oldUuid = avatarVertex.getProperty('uuid') as string;
      avatarVertex.setProperty('uuid', uuid);
      avatarVertex.setProperty('lastUpdated', Date.now());
      
      // Clean up old avatar (optional)
      await this.fileStore.deleteMutable(oldUuid);
    } else {
      // Create new avatar vertex
      avatarVertex = this.profilesTree.tree.newNamedVertex(avatarsVertex.id, 'avatar', {
        name: `${userId}_avatar.jpg`,
        uuid: uuid,
        mutable: true,
        mimeType: 'image/jpeg',
        size: imageData.length,
        userId: userId
      });
    }
  }
}
```

## Migration and Backward Compatibility

### Existing Files

- All existing hash-based files remain unchanged
- No migration required for existing file references
- Existing `sila://` URLs continue to work

### New File Creation

- Apps can choose between immutable (CAS) and mutable (UUID) storage
- Default behavior remains immutable for user-uploaded files
- Mutable storage used explicitly for specific use cases

### File Type Conversion

```typescript
class FileTypeConverter {
  async makeMutable(fileRef: FileReference): Promise<FileReference> {
    const fileVertex = await this.getFileVertex(fileRef);
    const hash = fileVertex.getProperty('hash') as string;
    
    // Read content from CAS
    const bytes = await this.fileStore.getBytes(hash);
    
    // Generate new UUID
    const uuid = this.fileStore.generateMutableUuid();
    
    // Store in mutable storage
    await this.fileStore.putMutable(uuid, bytes);
    
    // Update file vertex
    fileVertex.setProperty('uuid', uuid);
    fileVertex.setProperty('mutable', true);
    fileVertex.deleteProperty('hash');
    
    return fileRef; // Same reference, updated vertex
  }
  
  async makeImmutable(fileRef: FileReference): Promise<FileReference> {
    const fileVertex = await this.getFileVertex(fileRef);
    const uuid = fileVertex.getProperty('uuid') as string;
    
    // Read content from mutable storage
    const bytes = await this.fileStore.getMutable(uuid);
    
    // Store in CAS (will generate hash)
    const { hash } = await this.fileStore.putBytes(bytes);
    
    // Update file vertex
    fileVertex.setProperty('hash', hash);
    fileVertex.setProperty('mutable', false);
    fileVertex.deleteProperty('uuid');
    
    return fileRef; // Same reference, updated vertex
  }
}
```

## Security Considerations

### Access Control

- Mutable files inherit the same space isolation as immutable files
- UUID validation prevents directory traversal attacks
- File access controlled by space membership

### Data Integrity

- Mutable files don't provide content integrity guarantees (by design)
- Apps should implement their own integrity checks if needed
- Consider versioning for critical mutable files

### Encryption

- Mutable storage can be used for encrypted content (e.g., secrets)
- Encryption/decryption handled at application level
- FileStore provides raw byte storage

## Performance Considerations

### Storage Efficiency

- Mutable files don't benefit from deduplication
- Consider cleanup strategies for unused mutable files
- Monitor storage usage for mutable vs immutable files

### Access Patterns

- Mutable files may be accessed more frequently (e.g., thumbnails)
- Consider caching strategies for frequently accessed mutable files
- Range requests supported for large mutable files

### Memory Management

- Mutable files use same streaming approach as immutable files
- No additional memory overhead for mutable storage
- UUID generation is lightweight

## Testing Strategy

### Unit Tests

- FileStore mutable operations
- FileResolver mutable file handling
- Protocol handler mutable URL support
- File type conversion utilities

### Integration Tests

- End-to-end mutable file workflow
- Mixed immutable/mutable file scenarios
- Protocol handler with both file types
- App integration with mutable files

### Performance Tests

- Mutable file creation and updates
- Large mutable file handling
- Concurrent access to mutable files
- Storage efficiency comparisons

## Future Enhancements

### Versioning Support

```typescript
// Future: Versioned mutable files
interface VersionedMutableFile {
  uuid: string;
  version: number;
  content: Uint8Array;
  createdAt: number;
}

// Storage structure:
// mutable/uuid/{uuid}/{version}
```

### Atomic Updates

```typescript
// Future: Atomic mutable file updates
interface MutableFileTransaction {
  uuid: string;
  update: (currentContent: Uint8Array) => Promise<Uint8Array>;
}
```

### Compression

```typescript
// Future: Automatic compression for mutable files
interface MutableFileOptions {
  compress?: boolean;
  compressionLevel?: number;
}
```

## Conclusion

This proposal extends Sila's file storage system to support mutable files while maintaining the existing CAS architecture and providing a unified interface for apps. The system supports both immutable and mutable files through a consistent API, enabling new use cases like encrypted secrets, thumbnail caches, and user avatars while preserving the benefits of content-addressed storage for user files.

The implementation is designed to be backward-compatible, performant, and secure, with clear migration paths and testing strategies. The system provides the flexibility to choose the appropriate storage type for each use case while maintaining the simplicity and reliability of Sila's existing file system.