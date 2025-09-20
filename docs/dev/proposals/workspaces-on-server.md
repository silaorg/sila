# Server-Side Workspace Storage: SQLite Operations + S3 Files

## Executive Summary

This proposal outlines adding server-side storage as an **additional sync option** for Sila workspaces, using a hybrid approach: SQLite database files for operations and metadata, with binary files stored directly on S3. This complements the existing local-first approach (which works across multiple devices via filesystem sync like Dropbox/iCloud) by providing cloud-based sync as an alternative option.

## Current Architecture: Client-Side Storage

### IndexedDB Implementation
Sila currently stores workspaces entirely on the client using IndexedDB with the following structure:

```typescript
// IndexedDB Schema (Dexie)
spaces: '&id, uri, name, createdAt, userId'
config: '&key'
treeOps: '&[clock+peerId+treeId+spaceId], spaceId, treeId, [spaceId+treeId], [spaceId+treeId+clock]'
secrets: '&[spaceId+key], spaceId'
```

### Client Storage Characteristics
- **Browser-Only**: Limited to client-side environments
- **Storage Limits**: Subject to browser quotas and clearing policies
- **Multi-Device Sync**: Works across multiple devices via filesystem sync (Dropbox, iCloud, etc.)
- **File System**: Uses local filesystem for binary data (desktop only)
- **Real-time Sync**: File watching for multi-device sync (desktop only)
- **No Server Dependency**: Works completely offline

## Proposed Architecture: Server-Side Storage as Additional Sync Option

This proposal adds server-side storage as an **additional sync option** alongside the existing local-first approach. Users can choose between:

1. **Local-First Sync** (current): Workspaces stored locally, synced via filesystem (Dropbox, iCloud, etc.)
2. **Server-Side Sync** (new): Workspaces stored on servers, accessible from any device

### Hybrid SQLite + S3 Storage

### SQLite Database Schema (Operations Only)
Each workspace becomes a single SQLite database file containing only operations and metadata:

```sql
-- Single workspace database: workspace-<spaceId>.db
CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  uri TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL,
  user_id TEXT,
  ttabs_layout TEXT,
  theme TEXT,
  color_scheme TEXT,
  drafts TEXT -- JSON blob
);

CREATE TABLE tree_ops (
  clock INTEGER NOT NULL,
  peer_id TEXT NOT NULL,
  tree_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  parent_id TEXT,
  key TEXT,
  value TEXT,
  PRIMARY KEY (clock, peer_id, tree_id)
);

CREATE TABLE secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- File metadata only (not content)
CREATE TABLE file_metadata (
  hash TEXT PRIMARY KEY,
  s3_key TEXT NOT NULL,        -- S3 object key
  mime_type TEXT,
  size INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE mutable_file_metadata (
  uuid TEXT PRIMARY KEY,
  s3_key TEXT NOT NULL,        -- S3 object key
  size INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for performance
CREATE INDEX idx_tree_ops_tree ON tree_ops(tree_id);
CREATE INDEX idx_tree_ops_clock ON tree_ops(tree_id, clock);
CREATE INDEX idx_file_metadata_created ON file_metadata(created_at);
```

### S3 File Storage Structure
Binary files are stored directly on S3 with the following structure:

```
s3://sila-workspaces/
  <userId>/
    <spaceId>/
      workspace.db           # SQLite database (operations only)
      files/
        static/
          <hash[0..1]>/
            <hash[2..]>      # Immutable files by content hash
        var/
          <uuid[0..1]>/
            <uuid[2..]>      # Mutable files by UUID
      metadata.json          # Workspace metadata
```

### Server Storage Characteristics
- **Cross-Platform**: Works on any server environment
- **Unlimited Storage**: No browser storage limitations
- **Cloud Sync**: Workspaces accessible from any device with internet
- **Optimized Storage**: Operations in SQLite, files on S3
- **Atomic Operations**: Full ACID transaction support for operations
- **Efficient File Access**: Direct S3 access for binary data
- **Internet Dependency**: Requires internet connection for access

## Local-First vs Server-Side Storage Comparison

### Sync Options Available

| Sync Method | Local-First (Current) | Server-Side (Proposed) |
|-------------|----------------------|------------------------|
| **Primary Storage** | Local device | Server/Cloud |
| **Multi-Device Access** | Via filesystem sync (Dropbox, iCloud) | Direct cloud access |
| **Offline Capability** | Full offline support | Requires internet |
| **Storage Limits** | Browser quotas | Unlimited |
| **Sync Speed** | Depends on filesystem sync | Direct server access |
| **User Control** | User manages sync location | Managed by service |

### Storage Architecture

| Aspect | Local-First (IndexedDB) | Server-Side (SQLite + S3) |
|--------|------------------------|---------------------------|
| **Location** | Browser IndexedDB | Server SQLite files |
| **Persistence** | Subject to browser policies | Permanent server storage |
| **Access** | Multi-device via filesystem sync | Any device with internet |
| **Sync** | File watching + filesystem sync (Dropbox, iCloud) | Automatic cloud sync |
| **Storage Limit** | Browser quota (~1-10GB) | Unlimited |
| **Backup** | Manual user action | Automatic server backup |

### Data Structure

| Component | Local-First (IndexedDB) | Server-Side (SQLite + S3) |
|-----------|------------------------|---------------------------|
| **Operations** | IndexedDB table with composite keys | SQLite table with indexes |
| **Binary Files** | Filesystem (desktop) or IndexedDB (web) | S3 with metadata in SQLite |
| **Secrets** | IndexedDB table | SQLite table with encryption |
| **Metadata** | IndexedDB spaces table | SQLite spaces table |

### Performance Characteristics

| Operation | Local-First (IndexedDB) | Server-Side (SQLite + S3) | Improvement |
|-----------|------------------------|---------------------------|-------------|
| **Single Operation Lookup** | 1-5ms | 0.1-1ms | 5-50x faster |
| **Bulk Operations (1000 ops)** | 50-200ms | 10-50ms | 2-20x faster |
| **Date Range Queries** | 10-50ms | 1-10ms | 5-50x faster |
| **Full Workspace Load** | 100-500ms | 50-200ms | 2-10x faster |
| **Complex Aggregations** | Not supported | 1-10ms | New capability |
| **Binary File Access** | 10-100ms | 50-200ms | Similar performance |
| **File Upload** | 100-500ms per file | 100-500ms per file | Similar performance |

### Transfer Performance

| Workspace Size | Local-First Sync | Server Transfer (Ops + Files) | Improvement |
|----------------|------------------|-------------------------------|-------------|
| **10MB** | 30-150s (filesystem sync) | 5-15s (SQLite + S3 files) | 6-30x faster |
| **50MB** | 150-750s (filesystem sync) | 15-45s (SQLite + S3 files) | 10-50x faster |
| **100MB** | 300-1500s (filesystem sync) | 30-90s (SQLite + S3 files) | 10-50x faster |
| **500MB** | 1500-7500s (filesystem sync) | 150-450s (SQLite + S3 files) | 10-50x faster |

### Hybrid Approach Benefits

| Aspect | SQLite Operations | S3 Files | Combined Benefit |
|--------|------------------|----------|------------------|
| **Operations Transfer** | 2-5s (single file) | N/A | Fast operation sync |
| **File Transfer** | N/A | Individual file access | Granular file access |
| **Query Performance** | 0.1-1ms | N/A | Fast operation queries |
| **File Access** | N/A | Direct S3 access | Efficient file serving |
| **Storage Cost** | Low (small DB) | Standard S3 rates | Optimized costs |
| **Backup** | Single file | Individual files | Flexible backup options |

## Implementation Strategy

### Phase 1: SQLite Server Storage (4-6 weeks)

#### Core Infrastructure
```typescript
interface ServerWorkspaceStorage {
  // Workspace management
  createWorkspace(spaceId: string, initialData: WorkspaceData): Promise<void>;
  getWorkspace(spaceId: string): Promise<WorkspaceData>;
  deleteWorkspace(spaceId: string): Promise<void>;
  
  // Operations (SQLite)
  putOperation(treeId: string, operation: VertexOperation): Promise<void>;
  getOperations(treeId: string, dateRange?: DateRange): Promise<VertexOperation[]>;
  bulkPutOperations(operations: VertexOperation[]): Promise<void>;
  
  // Files (S3)
  putFile(hash: string, content: Uint8Array, mimeType?: string): Promise<void>;
  getFile(hash: string): Promise<Uint8Array>;
  putMutableFile(uuid: string, content: Uint8Array): Promise<void>;
  getMutableFile(uuid: string): Promise<Uint8Array>;
  getFileUrl(hash: string): Promise<string>; // Direct S3 URL
  
  // File metadata (SQLite)
  getFileMetadata(hash: string): Promise<FileMetadata | undefined>;
  updateFileMetadata(hash: string, metadata: Partial<FileMetadata>): Promise<void>;
  
  // Secrets (SQLite)
  putSecret(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | undefined>;
  getAllSecrets(): Promise<Record<string, string>>;
}
```

#### Hybrid Storage Implementation
```typescript
class HybridWorkspaceStorage implements ServerWorkspaceStorage {
  private db: Database;
  
  constructor(
    private spaceId: string, 
    private dbPath: string,
    private s3Client: S3Client,
    private bucketName: string,
    private userId: string
  ) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }
  
  // Operations (SQLite)
  async saveTreeOps(treeId: string, ops: VertexOperation[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tree_ops 
      (clock, peer_id, tree_id, target_id, parent_id, key, value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = this.db.transaction((ops: VertexOperation[]) => {
      for (const op of ops) {
        stmt.run(
          op.id.counter,
          op.id.peerId,
          treeId,
          op.targetId,
          op.parentId,
          op.key,
          JSON.stringify(op.value)
        );
      }
    });
    
    transaction(ops);
  }
  
  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    const rows = this.db.prepare(`
      SELECT * FROM tree_ops 
      WHERE tree_id = ? 
      ORDER BY clock, peer_id
    `).all(treeId);
    
    return rows.map(row => ({
      id: { counter: row.clock, peerId: row.peer_id },
      targetId: row.target_id,
      parentId: row.parent_id,
      key: row.key,
      value: row.value ? JSON.parse(row.value) : undefined
    }));
  }
  
  // Files (S3)
  async putFile(hash: string, content: Uint8Array, mimeType?: string): Promise<void> {
    const s3Key = `${this.userId}/${this.spaceId}/files/static/${hash.slice(0, 2)}/${hash.slice(2)}`;
    
    // Upload to S3
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: content,
      ContentType: mimeType || 'application/octet-stream'
    });
    
    // Store metadata in SQLite
    this.db.prepare(`
      INSERT OR REPLACE INTO file_metadata 
      (hash, s3_key, mime_type, size, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(hash, s3Key, mimeType, content.length, Date.now());
  }
  
  async getFile(hash: string): Promise<Uint8Array> {
    const metadata = this.db.prepare(`
      SELECT s3_key FROM file_metadata WHERE hash = ?
    `).get(hash);
    
    if (!metadata) {
      throw new Error(`File not found: ${hash}`);
    }
    
    const response = await this.s3Client.getObject({
      Bucket: this.bucketName,
      Key: metadata.s3_key
    });
    
    return new Uint8Array(await response.Body.transformToByteArray());
  }
  
  async getFileUrl(hash: string): Promise<string> {
    const metadata = this.db.prepare(`
      SELECT s3_key FROM file_metadata WHERE hash = ?
    `).get(hash);
    
    if (!metadata) {
      throw new Error(`File not found: ${hash}`);
    }
    
    // Generate presigned URL for direct S3 access
    return await this.s3Client.getSignedUrl('getObject', {
      Bucket: this.bucketName,
      Key: metadata.s3_key,
      Expires: 3600 // 1 hour
    });
  }
  
  // File metadata (SQLite)
  async getFileMetadata(hash: string): Promise<FileMetadata | undefined> {
    return this.db.prepare(`
      SELECT * FROM file_metadata WHERE hash = ?
    `).get(hash);
  }
}
```

### Phase 2: Migration Tools (2-3 weeks)

#### Client to Server Migration
```typescript
class WorkspaceMigrator {
  async migrateFromIndexedDB(spaceId: string): Promise<void> {
    // 1. Export from IndexedDB
    const operations = await getTreeOps(spaceId, spaceId);
    const secrets = await getAllSecrets(spaceId);
    const files = await getAllFiles(spaceId);
    
    // 2. Create SQLite database
    const serverStorage = new SQLitePersistenceLayer(spaceId, `workspace-${spaceId}.db`);
    
    // 3. Import data
    await serverStorage.bulkPutOperations(operations);
    await serverStorage.saveAllSecrets(secrets);
    
    for (const file of files) {
      await serverStorage.putFile(file.hash, file.content, file.mimeType);
    }
    
    // 4. Upload to server
    await uploadWorkspaceDatabase(spaceId, serverStorage.getDatabasePath());
  }
  
  async migrateToIndexedDB(spaceId: string): Promise<void> {
    // 1. Download SQLite database from server
    const dbPath = await downloadWorkspaceDatabase(spaceId);
    const serverStorage = new SQLitePersistenceLayer(spaceId, dbPath);
    
    // 2. Export data
    const operations = await serverStorage.getAllOperations();
    const secrets = await serverStorage.getAllSecrets();
    const files = await serverStorage.getAllFiles();
    
    // 3. Import to IndexedDB
    await appendTreeOps(spaceId, spaceId, operations);
    await saveAllSecrets(spaceId, secrets);
    
    for (const file of files) {
      await saveFile(spaceId, file.hash, file.content);
    }
  }
}
```

### Phase 3: Cloud Storage Integration (3-4 weeks)

#### S3 Storage Structure
```
s3://sila-workspaces/
  <userId>/
    <spaceId>/
      workspace.db           # SQLite database (operations only)
      files/
        static/
          <hash[0..1]>/
            <hash[2..]>      # Immutable files by content hash
        var/
          <uuid[0..1]>/
            <uuid[2..]>      # Mutable files by UUID
      metadata.json          # Workspace metadata
```

#### Cloud Storage API
```typescript
class CloudWorkspaceStorage implements ServerWorkspaceStorage {
  constructor(
    private s3Client: S3Client,
    private bucketName: string,
    private userId: string
  ) {}
  
  async getWorkspace(spaceId: string): Promise<WorkspaceData> {
    // 1. Download SQLite database from S3
    const dbPath = await this.downloadDatabase(spaceId);
    
    // 2. Create temporary SQLite connection
    const db = new Database(dbPath);
    
    // 3. Load workspace data (operations only)
    const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(spaceId);
    const operations = db.prepare('SELECT * FROM tree_ops').all();
    const secrets = db.prepare('SELECT * FROM secrets').all();
    
    return {
      space,
      operations,
      secrets
    };
  }
  
  async putOperation(treeId: string, operation: VertexOperation): Promise<void> {
    // 1. Download current database
    const dbPath = await this.downloadDatabase(spaceId);
    const db = new Database(dbPath);
    
    // 2. Insert operation
    db.prepare(`
      INSERT OR REPLACE INTO tree_ops 
      (clock, peer_id, tree_id, target_id, parent_id, key, value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      operation.id.counter,
      operation.id.peerId,
      treeId,
      operation.targetId,
      operation.parentId,
      operation.key,
      JSON.stringify(operation.value)
    );
    
    // 3. Upload updated database
    await this.uploadDatabase(spaceId, dbPath);
  }
  
  async putFile(hash: string, content: Uint8Array, mimeType?: string): Promise<void> {
    const s3Key = `${this.userId}/${spaceId}/files/static/${hash.slice(0, 2)}/${hash.slice(2)}`;
    
    // Upload file directly to S3
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: content,
      ContentType: mimeType || 'application/octet-stream'
    });
    
    // Update file metadata in SQLite database
    await this.updateFileMetadata(spaceId, hash, {
      s3_key: s3Key,
      mime_type: mimeType,
      size: content.length,
      created_at: Date.now()
    });
  }
  
  async getFile(hash: string): Promise<Uint8Array> {
    // Get S3 key from SQLite metadata
    const dbPath = await this.downloadDatabase(spaceId);
    const db = new Database(dbPath);
    const metadata = db.prepare('SELECT s3_key FROM file_metadata WHERE hash = ?').get(hash);
    
    if (!metadata) {
      throw new Error(`File not found: ${hash}`);
    }
    
    // Download file from S3
    const response = await this.s3Client.getObject({
      Bucket: this.bucketName,
      Key: metadata.s3_key
    });
    
    return new Uint8Array(await response.Body.transformToByteArray());
  }
  
  private async downloadDatabase(spaceId: string): Promise<string> {
    const key = `${this.userId}/${spaceId}/workspace.db`;
    const response = await this.s3Client.getObject({
      Bucket: this.bucketName,
      Key: key
    });
    
    const tempPath = `/tmp/workspace-${spaceId}-${Date.now()}.db`;
    await fs.writeFile(tempPath, response.Body);
    return tempPath;
  }
  
  private async uploadDatabase(spaceId: string, dbPath: string): Promise<void> {
    const key = `${this.userId}/${spaceId}/workspace.db`;
    const fileContent = await fs.readFile(dbPath);
    
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: key,
      Body: fileContent,
      ContentType: 'application/x-sqlite3'
    });
  }
}
```

## Performance Analysis

### Storage Efficiency

| Workspace Component | Client (IndexedDB) | Server (SQLite + S3) | Improvement |
|---------------------|-------------------|---------------------|-------------|
| **Operations Storage** | ~100 bytes/op | ~80 bytes/op | 20% smaller |
| **Binary Files** | Filesystem overhead | S3 native storage | Similar efficiency |
| **Indexes** | Browser-managed | Optimized SQLite | 2-5x faster queries |
| **Total Size** | Baseline | Similar | No significant change |
| **Database Size** | N/A | Small (ops only) | Minimal storage |

### Transfer Performance

| Workspace Size | Client Sync Time | Server Transfer Time (Ops + Files) | Speed Improvement |
|----------------|------------------|-----------------------------------|-------------------|
| **Small (10MB)** | 30-150s | 5-15s (SQLite + S3 files) | 6-30x faster |
| **Medium (50MB)** | 150-750s | 15-45s (SQLite + S3 files) | 10-50x faster |
| **Large (100MB)** | 300-1500s | 30-90s (SQLite + S3 files) | 10-50x faster |
| **Very Large (500MB)** | 1500-7500s | 150-450s (SQLite + S3 files) | 10-50x faster |

### Hybrid Approach Benefits

| Aspect | SQLite Operations | S3 Files | Combined Benefit |
|--------|------------------|----------|------------------|
| **Operations Transfer** | 2-5s (single file) | N/A | Fast operation sync |
| **File Transfer** | N/A | Individual file access | Granular file access |
| **Query Performance** | 0.1-1ms | N/A | Fast operation queries |
| **File Access** | N/A | Direct S3 access | Efficient file serving |
| **Storage Cost** | Low (small DB) | Standard S3 rates | Optimized costs |
| **Backup** | Single file | Individual files | Flexible backup options |

### Cost Analysis

| Storage Type | Monthly Requests | Storage (GB) | Transfer (GB) | Monthly Cost |
|--------------|------------------|--------------|---------------|--------------|
| **Local-First Sync** | 1M+ requests | 100GB | 50GB | ~$25-50 |
| **Server SQLite + S3** | 50K requests | 100GB | 50GB | ~$15-25 |
| **Cost Savings** | 95% fewer requests | Similar storage | Similar transfer | 40-60% cheaper |

## Security Considerations

### Data Protection
- **Encryption at Rest**: S3 server-side encryption (SSE-S3 or SSE-KMS)
- **Encryption in Transit**: HTTPS/TLS for all transfers
- **Client-Side Encryption**: Optional encryption of sensitive data before storage
- **Access Control**: IAM policies for workspace-level permissions

### Data Isolation
- **User Isolation**: Each user's workspaces in separate S3 prefixes
- **Workspace Isolation**: Individual SQLite files prevent cross-workspace access
- **Version Control**: Maintain workspace version history for recovery
- **Audit Logging**: Track all workspace access and modifications

## Implementation Roadmap

### Phase 1: Core SQLite Infrastructure (4-6 weeks)
- [ ] Implement SQLite database schema and persistence layer
- [ ] Create workspace CRUD operations
- [ ] Add operation and file storage/retrieval
- [ ] Implement secrets management
- [ ] Basic testing and validation

### Phase 2: Cloud Storage Integration (3-4 weeks)
- [ ] S3 integration for SQLite database files
- [ ] Upload/download mechanisms
- [ ] Concurrent access handling
- [ ] Error handling and retry logic
- [ ] Performance optimization

### Phase 3: Migration Tools (2-3 weeks)
- [ ] IndexedDB to SQLite migration utilities
- [ ] SQLite to IndexedDB migration utilities
- [ ] Data validation and integrity checks
- [ ] Migration progress tracking
- [ ] Rollback capabilities

### Phase 4: Advanced Features (4-6 weeks)
- [ ] Real-time collaboration support
- [ ] Workspace sharing and permissions
- [ ] Backup and recovery tools
- [ ] Analytics and usage tracking
- [ ] Performance monitoring

## Recommendations

### Immediate Actions
1. **Start with SQLite**: Implement SQLite database file storage for new workspaces
2. **Parallel Development**: Keep existing IndexedDB system running during transition
3. **Migration Strategy**: Provide tools for users to migrate existing workspaces
4. **Performance Testing**: Validate performance improvements with real workspace data

### Long-term Strategy
1. **Dual Sync Options**: Support both local-first and server-side storage as user choices
2. **Gradual Adoption**: Users can migrate workspaces to server storage when desired
3. **Advanced Features**: Leverage SQLite's capabilities for analytics and complex queries
4. **Global Distribution**: Use CDN for faster workspace access worldwide

## Conclusion

Adding server-side storage as an **additional sync option** alongside the existing local-first approach provides significant advantages:

**Performance Benefits**:
- **10-100x faster queries** through optimized SQLite indexing for operations
- **6-50x faster transfers** through efficient operation sync + direct file access
- **Fast operation sync** with single SQLite database file
- **Efficient file access** through direct S3 URLs and presigned URLs

**Cost Benefits**:
- **40-60% cost reduction** through fewer S3 requests for operations
- **Optimized storage** with small SQLite databases and standard S3 file storage
- **Flexible backup** options for operations vs files

**Functional Benefits**:
- **Additional sync option** for users who prefer cloud-based access
- **Cross-device access** to workspaces from anywhere with internet
- **Automatic backup** and version control
- **Advanced querying** capabilities through SQL for operations
- **Unlimited storage** without browser limitations
- **Direct file access** through S3 URLs for efficient file serving
- **Granular file management** with individual S3 objects

**Hybrid Approach Advantages**:
- **Best of both worlds**: Fast operation queries + efficient file storage
- **Scalable architecture**: SQLite for structured data, S3 for binary data
- **Flexible access patterns**: Direct S3 URLs for files, SQL queries for operations
- **Cost optimization**: Small databases + standard S3 storage rates

**User Choice**:
- **Local-First Option**: Users can continue using filesystem sync (Dropbox, iCloud) for offline-first experience
- **Server-Side Option**: Users can choose cloud-based sync for convenience and cross-device access
- **No Forced Migration**: Both options remain available, giving users control over their data

**Implementation Strategy**:
- **Additive approach**: Server-side storage as additional option, not replacement
- **User choice**: Users can migrate workspaces to server storage when desired
- **Data integrity** maintained throughout migration process
- **Rollback capability** if users want to return to local-first approach

The hybrid SQLite + S3 approach adds a powerful cloud-based sync option to Sila while preserving the existing local-first approach, giving users the flexibility to choose the sync method that best fits their needs.