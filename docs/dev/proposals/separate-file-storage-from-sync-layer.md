# Proposal: Separate File Storage from SyncLayer

## Current State

File storage is currently coupled to `SyncLayer` via the optional `getFileStoreProvider()` method:

```typescript
interface SyncLayer {
  // ... operation sync methods
  getFileStoreProvider?(): FileStoreProvider
}
```

`SpaceRunner2` iterates through layers to find one that provides file storage and attaches it to the space.

## Problem

**Files and operations have fundamentally different sync characteristics:**

1. **Content-addressed vs. operation-based**
   - Files are immutable, content-addressed (SHA256 hash)
   - Operations are ordered, mutable (CRDTs)

2. **Sync patterns**
   - Operations need real-time sync and conflict resolution
   - Files just need availability (exists/doesn't exist)

3. **Storage requirements**
   - Operations are small, frequent
   - Files can be large, infrequent

4. **Layer coupling**
   - Not every sync layer needs file storage
   - File storage could be completely independent (e.g., S3, CDN)

## Proposal

### Separate `FileStoreProvider` from `SyncLayer`

**Option A: Dedicated File Storage Configuration**
```typescript
class SpaceManager2 {
  constructor(options: {
    setupSyncLayers: (uri: string) => SyncLayer[]
    setupFileStore?: (uri: string) => FileStoreProvider  // Single provider
  })
}
```

**Option B: File Store as First-Class Layer**
```typescript
interface FileLayer {
  id: string
  getFileStoreProvider(): FileStoreProvider
}

class SpaceManager2 {
  constructor(options: {
    setupSyncLayers: (uri: string) => SyncLayer[]
    setupFileLayer?: (uri: string) => FileLayer  // Separate concern
  })
}
```

## Benefits

1. **Clearer separation of concerns**
   - Operation sync and file storage are independent
   - Easier to reason about each system

2. **Simpler SyncLayer interface**
   - No optional file-related methods
   - Focus purely on operation synchronization

3. **More flexible file storage**
   - Could use different storage per space (filesystem, S3, memory)
   - Easy to disable file storage entirely
   - Could implement lazy loading or on-demand fetch

4. **Better testing**
   - Test file storage independently of sync
   - Mock file storage without mocking entire sync layer

## Implementation

1. Remove `getFileStoreProvider?()` from `SyncLayer` interface
2. Add dedicated file storage setup to `SpaceManager2` constructor
3. Update `SpaceRunner2` to accept separate file provider
4. Update `FileSystemSyncLayer` - remove file provider method
5. Update tests to configure file storage separately

## Migration

Existing code using `FileSystemSyncLayer` would need:
```typescript
// Before
new SpaceManager2({
  setupSyncLayers: (uri) => [new FileSystemSyncLayer(...)]
})

// After (Option A)
new SpaceManager2({
  setupSyncLayers: (uri) => [new FileSystemSyncLayer(...)],
  setupFileStore: (uri) => ({
    getSpaceRootPath: () => spacePath,
    getFs: () => nodeFs
  })
})
```

## Questions

1. Should we support **multiple** file stores per space?
   - Probably not needed - one is sufficient
   - Could add fallback/redundancy later if needed

2. Should file storage be **optional** at the SpaceManager level?
   - Yes - some spaces might not need files
   - Already optional via `?` in interfaces

3. How to handle **file sync across devices**?
   - Files are content-addressed, so sync is just "copy if missing"
   - Could be handled by backend layer separately
   - Not a concern for local-only usage

## Recommendation

**Use Option B** (File Store as First-Class Layer) because:

### Architecture Benefits
- **Symmetry**: Files become just another type of layer alongside operation sync
- **Flexibility**: Easy to swap implementations (local FS, remote FS, S3, etc.)
- **Clarity**: `FileLayer` is a distinct concept from `SyncLayer`
- **Testability**: Mock file layers independently

### Real-World Use Cases

**Desktop Application:**
```typescript
new SpaceManager2({
  setupSyncLayers: (uri) => [
    new FileSystemSyncLayer(localPath, spaceId, nodeFs)
  ],
  setupFileLayer: (uri) => 
    new LocalFileLayer(localPath, nodeFs)  // Local filesystem
})
```

**Server-Based Spaces (Client):**
```typescript
new SpaceManager2({
  setupSyncLayers: (uri) => [
    new BackendSyncLayer(serverUrl, spaceId)
  ],
  setupFileLayer: (uri) => 
    new RemoteFileLayer(serverUrl, spaceId)  // HTTP/WebSocket to server
})
```

**Hybrid (Desktop + Server Sync):**
```typescript
new SpaceManager2({
  setupSyncLayers: (uri) => [
    new FileSystemSyncLayer(localPath, spaceId, nodeFs),
    new BackendSyncLayer(serverUrl, spaceId)
  ],
  setupFileLayer: (uri) => 
    new LocalFileLayer(localPath, nodeFs)  // Keep files local
})
```

## Implementation Plan

### 1. Define `FileLayer` Interface
```typescript
interface FileLayer {
  id: string
  getFileStoreProvider(): FileStoreProvider
  
  // Future: Could add file-specific sync methods
  // uploadMissingFiles?(): Promise<void>
  // downloadMissingFiles?(): Promise<void>
}
```

### 2. Create Implementations

**LocalFileLayer** (for desktop):
```typescript
class LocalFileLayer implements FileLayer {
  readonly id = 'local-file-layer'
  
  constructor(
    private spacePath: string,
    private fs: AppFileSystem
  ) {}
  
  getFileStoreProvider(): FileStoreProvider {
    return {
      getSpaceRootPath: () => this.spacePath,
      getFs: () => this.fs
    }
  }
}
```

**RemoteFileLayer** (for server-based spaces):
```typescript
class RemoteFileLayer implements FileLayer {
  readonly id = 'remote-file-layer'
  
  constructor(
    private serverUrl: string,
    private spaceId: string
  ) {}
  
  getFileStoreProvider(): FileStoreProvider {
    // Returns provider that fetches files via HTTP
    return {
      getSpaceRootPath: () => `/remote/${this.spaceId}`,
      getFs: () => new HttpFileSystem(this.serverUrl)  // Virtual FS over HTTP
    }
  }
}
```

### 3. Update `SpaceManager2`
```typescript
class SpaceManager2 {
  constructor(options: {
    setupSyncLayers: (uri: string) => SyncLayer[]
    setupFileLayer?: (uri: string) => FileLayer  // Single file layer
  })
  
  async loadSpace(uri: string): Promise<Space> {
    const syncLayers = this.setupSyncLayers(uri)
    const fileLayer = this.options.setupFileLayer?.(uri)
    
    const runner = SpaceRunner2.fromURI(uri, syncLayers, fileLayer)
    // ...
  }
}
```

### 4. Update `SpaceRunner2`
```typescript
class SpaceRunner2 {
  static fromURI(
    uri: string, 
    layers: SyncLayer[],
    fileLayer?: FileLayer  // Accept dedicated file layer
  ) {
    const runner = new SpaceRunner2(uri, layers, undefined, fileLayer)
    return runner
  }
  
  private attachFileStoreProvider(): void {
    if (!this.fileLayer) return
    if (this.space!.fileStore) return
    
    const provider = this.fileLayer.getFileStoreProvider()
    this.space!.setFileStoreProvider(provider)
  }
}
```

### 5. Migration Steps

1. Create `FileLayer` interface in `spaces/files/FileLayer.ts`
2. Create `LocalFileLayer` implementation
3. Update `SyncLayer.ts` - remove `getFileStoreProvider?()`
4. Update `SpaceManager2` constructor options
5. Update `SpaceRunner2` to accept `fileLayer` parameter
6. Update tests to use new API
7. Create `RemoteFileLayer` implementation (future)

## Future Enhancements

Once this is in place, we could add:
- **File sync methods**: `uploadMissingFiles()`, `downloadMissingFiles()`
- **Caching layer**: Local cache + remote fallback
- **CDN support**: Dedicated CDN file layer
- **Offline mode**: Queue uploads when offline, sync when online

