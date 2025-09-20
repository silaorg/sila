# Server-Side Workspace Storage: SQLite Operations + S3 Files

## Executive Summary

This proposal outlines adding server-side storage as an **additional sync option** for Sila workspaces, using real-time sync: clients sync RepTree operations via WebSocket and files via S3, while servers store operations in SQLite databases. This complements the existing local-first approach (which works across multiple devices via filesystem sync like Dropbox/iCloud) by providing cloud-based real-time sync as an alternative option.

## Current Architecture: Multi-Layer Persistence

### Persistence Layer System
Sila uses a pluggable persistence layer system that supports multiple storage backends simultaneously. The current implementation includes:

1. **IndexedDBPersistenceLayer**: Browser-based storage for operations and secrets
2. **FileSystemPersistenceLayer**: File-based storage for operations, secrets, and files

### Current Storage Implementation

#### IndexedDBPersistenceLayer
```typescript
// IndexedDB Schema (Dexie)
spaces: '&id, uri, name, createdAt, userId'
config: '&key'
treeOps: '&[clock+peerId+treeId+spaceId], spaceId, treeId, [spaceId+treeId], [spaceId+treeId+clock]'
secrets: '&[spaceId+key], spaceId'
```

#### FileSystemPersistenceLayer
```typescript
// File System Structure
<spacePath>/
  sila.md                    # User-readable description
  space-v1/
    space.json              # Space metadata
    secrets                 # Encrypted secrets file
    ops/                    # Operations organized by tree and date
      <treeId[0..1]>/
        <treeId[2..]>/
          <year>/
            <month>/
              <day>/
                <peerId>.jsonl  # Operations for each peer per day
    files/
      static/sha256/        # Immutable files by content hash
      var/uuid/             # Mutable files by UUID
```

### Current Storage Characteristics
- **Multi-Layer**: Supports multiple persistence layers simultaneously
- **Browser Storage**: IndexedDB for operations and secrets (all platforms)
- **File System**: Local filesystem for operations, secrets, and files (desktop only)
- **Dual Persistence**: File system spaces use both IndexedDB + FileSystem layers
- **Multi-Device Sync**: Works across multiple devices via filesystem sync (Dropbox, iCloud, etc.)
- **Real-time Sync**: File watching for two-way sync between devices
- **No Server Dependency**: Works completely offline

## Proposed Architecture: Server-Side Storage as Additional Sync Option

This proposal adds server-side storage as an **additional sync option** alongside the existing multi-layer persistence approach. Users can choose between:

1. **Local-First Sync** (current): 
   - **File System Spaces**: IndexedDB + FileSystem layers, synced via filesystem (Dropbox, iCloud, etc.)
   - **Local-Only Spaces**: IndexedDB layer only (browser storage)
2. **Server-Side Sync** (new): Workspaces stored on servers, accessible from any device

### Server-Side Persistence Layer

This would add a third persistence layer type that runs on the client but syncs with servers:

3. **ServerPersistenceLayer**: Client-side layer that syncs RepTree operations via WebSocket and files via S3

**Key Point**: Server-synced spaces are still **client-side layers** - they sync RepTree operations and files with servers using real-time sync. The client can open both types of spaces simultaneously:

- **Local-First Spaces**: IndexedDB + FileSystem layers (current)
- **Server-Synced Spaces**: IndexedDB + ServerPersistenceLayer (new)
- **Hybrid Spaces**: IndexedDB + FileSystem + ServerPersistenceLayer (future possibility)

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
| **Primary Storage** | Local device (IndexedDB + FileSystem) | Server/Cloud (SQLite + S3) |
| **Multi-Device Access** | Via filesystem sync (Dropbox, iCloud) | Direct cloud access |
| **Offline Capability** | Full offline support | Requires internet |
| **Storage Limits** | Browser quotas + disk space | Unlimited |
| **Sync Speed** | Depends on filesystem sync | Direct server access |
| **User Control** | User manages sync location | Managed by service |
| **Persistence Layers** | IndexedDB + FileSystem | SQLite + S3 |

### Storage Architecture

| Aspect | Local-First (IndexedDB + FileSystem) | Server-Side (SQLite + S3) |
|--------|-------------------------------------|---------------------------|
| **Location** | Browser IndexedDB + Local filesystem | Server SQLite files + S3 |
| **Persistence** | Subject to browser policies + disk space | Permanent server storage |
| **Access** | Multi-device via filesystem sync | Any device with internet |
| **Sync** | File watching + filesystem sync (Dropbox, iCloud) | Automatic cloud sync |
| **Storage Limit** | Browser quota (~1-10GB) + disk space | Unlimited |
| **Backup** | Manual user action | Automatic server backup |

### Data Structure

| Component | Local-First (IndexedDB + FileSystem) | Server-Side (SQLite + S3) |
|-----------|-------------------------------------|---------------------------|
| **Operations** | IndexedDB + JSONL files (organized by date) | SQLite table with indexes |
| **Binary Files** | Filesystem (static/sha256, var/uuid) | S3 with metadata in SQLite |
| **Secrets** | IndexedDB + encrypted files | SQLite table with encryption |
| **Metadata** | IndexedDB spaces table + space.json | SQLite spaces table |


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

#### ServerPersistenceLayer Implementation
```typescript
class ServerPersistenceLayer implements PersistenceLayer {
  readonly id: string;
  readonly type = 'remote' as const;
  
  private _connected = false;
  private s3Client: S3Client;
  private db: Database | null = null;
  
  constructor(
    private spaceId: string,
    private serverConfig: {
      s3Client: S3Client;
      bucketName: string;
      userId: string;
    }
  ) {
    this.id = `server-${spaceId}`;
    this.s3Client = serverConfig.s3Client;
  }
  
  async connect(): Promise<void> {
    if (this._connected) return;
    
    // Download SQLite database from S3
    const dbPath = await this.downloadDatabase();
    this.db = new Database(dbPath);
    this.initializeSchema();
    
    this._connected = true;
  }
  
  async disconnect(): Promise<void> {
    if (!this._connected) return;
    
    // Upload any pending changes back to S3
    if (this.db) {
      await this.uploadDatabase();
      this.db.close();
      this.db = null;
    }
    
    this._connected = false;
  }
  
  // Operations (SQLite)
  async saveTreeOps(treeId: string, ops: VertexOperation[]): Promise<void> {
    if (!this.db) throw new Error('Not connected');
    
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
    
    // Periodically sync to server (or on disconnect)
    await this.syncToServer();
  }
  
  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    if (!this.db) throw new Error('Not connected');
    
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
  
  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    return this.loadTreeOps(this.spaceId);
  }
  
  async loadSecrets(): Promise<Record<string, string> | undefined> {
    if (!this.db) throw new Error('Not connected');
    
    const rows = this.db.prepare('SELECT * FROM secrets').all();
    if (rows.length === 0) return undefined;
    
    const secrets: Record<string, string> = {};
    for (const row of rows) {
      secrets[row.key] = row.value;
    }
    return secrets;
  }
  
  async saveSecrets(secrets: Record<string, string>): Promise<void> {
    if (!this.db) throw new Error('Not connected');
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO secrets (key, value)
      VALUES (?, ?)
    `);
    
    const transaction = this.db.transaction((secrets: Record<string, string>) => {
      for (const [key, value] of Object.entries(secrets)) {
        stmt.run(key, value);
      }
    });
    
    transaction(secrets);
    await this.syncToServer();
  }
  
  // File operations (S3)
  async putFile(hash: string, content: Uint8Array, mimeType?: string): Promise<void> {
    const s3Key = `${this.serverConfig.userId}/${this.spaceId}/files/static/${hash.slice(0, 2)}/${hash.slice(2)}`;
    
    // Upload to S3
    await this.s3Client.putObject({
      Bucket: this.serverConfig.bucketName,
      Key: s3Key,
      Body: content,
      ContentType: mimeType || 'application/octet-stream'
    });
    
    // Store metadata in local SQLite
    if (this.db) {
      this.db.prepare(`
        INSERT OR REPLACE INTO file_metadata 
        (hash, s3_key, mime_type, size, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(hash, s3Key, mimeType, content.length, Date.now());
    }
  }
  
  async getFile(hash: string): Promise<Uint8Array> {
    if (!this.db) throw new Error('Not connected');
    
    const metadata = this.db.prepare(`
      SELECT s3_key FROM file_metadata WHERE hash = ?
    `).get(hash);
    
    if (!metadata) {
      throw new Error(`File not found: ${hash}`);
    }
    
    const response = await this.s3Client.getObject({
      Bucket: this.serverConfig.bucketName,
      Key: metadata.s3_key
    });
    
    return new Uint8Array(await response.Body.transformToByteArray());
  }
  
  // Server sync methods
  private async downloadDatabase(): Promise<string> {
    const key = `${this.serverConfig.userId}/${this.spaceId}/workspace.db`;
    
    try {
      const response = await this.s3Client.getObject({
        Bucket: this.serverConfig.bucketName,
        Key: key
      });
      
      const tempPath = `/tmp/workspace-${this.spaceId}-${Date.now()}.db`;
      const fileContent = await response.Body.transformToByteArray();
      await fs.writeFile(tempPath, fileContent);
      return tempPath;
    } catch (error) {
      // If database doesn't exist, create a new one
      const tempPath = `/tmp/workspace-${this.spaceId}-${Date.now()}.db`;
      const db = new Database(tempPath);
      this.initializeSchema(db);
      db.close();
      return tempPath;
    }
  }
  
  private async uploadDatabase(): Promise<void> {
    if (!this.db) return;
    
    const key = `${this.serverConfig.userId}/${this.spaceId}/workspace.db`;
    const dbPath = this.db.name; // SQLite database file path
    
    const fileContent = await fs.readFile(dbPath);
    
    await this.s3Client.putObject({
      Bucket: this.serverConfig.bucketName,
      Key: key,
      Body: fileContent,
      ContentType: 'application/x-sqlite3'
    });
  }
  
  private async syncToServer(): Promise<void> {
    // Debounced sync to avoid too many server calls
    // Implementation would include debouncing logic
    await this.uploadDatabase();
  }
  
  private initializeSchema(db?: Database): void {
    const database = db || this.db;
    if (!database) return;
    
    // Create tables as shown in the schema section
    database.exec(`
      CREATE TABLE IF NOT EXISTS spaces (
        id TEXT PRIMARY KEY,
        uri TEXT NOT NULL,
        name TEXT,
        created_at INTEGER NOT NULL,
        user_id TEXT
      );
      
      CREATE TABLE IF NOT EXISTS tree_ops (
        clock INTEGER NOT NULL,
        peer_id TEXT NOT NULL,
        tree_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        parent_id TEXT,
        key TEXT,
        value TEXT,
        PRIMARY KEY (clock, peer_id, tree_id)
      );
      
      CREATE TABLE IF NOT EXISTS secrets (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS file_metadata (
        hash TEXT PRIMARY KEY,
        s3_key TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_tree_ops_tree ON tree_ops(tree_id);
      CREATE INDEX IF NOT EXISTS idx_tree_ops_clock ON tree_ops(tree_id, clock);
    `);
  }
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

### How Client-Side Server Layers Work

#### Space Creation and Opening
```typescript
// Current: Local-first space
const localSpace = await spaceManager.loadSpace(
  { id: 'space1', uri: '/path/to/space', name: 'My Space', createdAt: new Date(), userId: null },
  [
    new IndexedDBPersistenceLayer('space1'),
    new FileSystemPersistenceLayer('/path/to/space', 'space1', fs)
  ]
);

// New: Server-synced space
const serverSpace = await spaceManager.loadSpace(
  { id: 'space2', uri: 'https://api.sila.com/spaces/space2', name: 'Cloud Space', createdAt: new Date(), userId: 'user123' },
  [
    new IndexedDBPersistenceLayer('space2'),  // Still keep local cache
    new ServerPersistenceLayer('space2', {
      s3Client: s3Client,
      bucketName: 'sila-workspaces',
      userId: 'user123'
    })
  ]
);

// Both spaces can be open simultaneously in the same client!
```

#### Persistence Layer Selection
```typescript
// Updated persistenceUtils.ts
export function createPersistenceLayersForURI(spaceId: string, uri: string): PersistenceLayer[] {
  const layers: PersistenceLayer[] = [];

  if (uri.startsWith("local://")) {
    // Local-only spaces: IndexedDB only
    layers.push(new IndexedDBPersistenceLayer(spaceId));
  } else if (uri.startsWith("http://") || uri.startsWith("https://")) {
    // Server-synced spaces: IndexedDB + ServerPersistenceLayer
    layers.push(new IndexedDBPersistenceLayer(spaceId));
    layers.push(new ServerPersistenceLayer(spaceId, {
      s3Client: getS3Client(),
      bucketName: 'sila-workspaces',
      userId: getCurrentUserId()
    }));
  } else {
    // File system path: IndexedDB + FileSystem (dual persistence)
    layers.push(new IndexedDBPersistenceLayer(spaceId));
    layers.push(new FileSystemPersistenceLayer(uri, spaceId, clientState.fs));
  }

  return layers;
}
```

### Phase 2: Real-Time Sync Implementation (3-4 weeks)

#### Real-Time Sync Architecture
The key insight is that **clients don't do SQL** - they sync RepTree operations and files with the server using real-time sync:

```typescript
class ServerPersistenceLayer implements PersistenceLayer {
  // Real-time sync with server
  async startListening(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void> {
    // WebSocket connection to server for real-time sync
    this.wsConnection = new WebSocket(`wss://api.sila.com/spaces/${this.spaceId}/sync`);
    
    this.wsConnection.onmessage = (event) => {
      const { treeId, operations } = JSON.parse(event.data);
      onIncomingOps(treeId, operations);
    };
  }
  
  async saveTreeOps(treeId: string, ops: VertexOperation[]): Promise<void> {
    // Send operations to server via WebSocket
    this.wsConnection.send(JSON.stringify({
      type: 'operations',
      treeId,
      operations: ops
    }));
  }
  
  // Files are synced separately via S3
  async putFile(hash: string, content: Uint8Array, mimeType?: string): Promise<void> {
    // Direct upload to S3
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: `${this.userId}/${this.spaceId}/files/${hash}`,
      Body: content,
      ContentType: mimeType
    });
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

### Phase 3: Advanced Features (4-6 weeks)
- [ ] Real-time collaboration support
- [ ] Workspace sharing and permissions
- [ ] Backup and recovery tools
- [ ] Analytics and usage tracking
- [ ] Performance monitoring

## Recommendations

### Immediate Actions
1. **Start with ServerPersistenceLayer**: Implement real-time sync for new workspaces
2. **Parallel Development**: Keep existing persistence layers running during transition
3. **Real-Time Sync**: Focus on WebSocket-based operation sync and S3 file storage
4. **Testing**: Validate real-time sync with real workspace data

### Long-term Strategy
1. **Dual Sync Options**: Support both local-first and server-side storage as user choices
2. **Gradual Adoption**: Users can migrate workspaces to server storage when desired
3. **Advanced Features**: Leverage SQLite's capabilities for analytics and complex queries
4. **Global Distribution**: Use CDN for faster workspace access worldwide

## Conclusion

Adding server-side storage as an **additional sync option** alongside the existing local-first approach provides significant advantages:

**Technical Benefits**:
- **Optimized queries** through SQLite indexing for operations
- **Efficient sync** with single SQLite database file
- **Direct file access** through S3 URLs and presigned URLs
- **Structured storage** with small SQLite databases and standard S3 file storage

**Functional Benefits**:
- **Additional sync option** for users who prefer cloud-based access
- **Cross-device access** to workspaces from anywhere with internet
- **Automatic backup** and version control
- **Advanced querying** capabilities through SQL for operations
- **Unlimited storage** without browser limitations
- **Direct file access** through S3 URLs for efficient file serving
- **Granular file management** with individual S3 objects

**Hybrid Approach Advantages**:
- **Best of both worlds**: Optimized operation queries + efficient file storage
- **Scalable architecture**: SQLite for structured data, S3 for binary data
- **Flexible access patterns**: Direct S3 URLs for files, SQL queries for operations
- **Structured approach**: Small databases + standard S3 storage

**User Choice**:
- **Local-First Option**: Users can continue using IndexedDB + FileSystem layers with filesystem sync (Dropbox, iCloud) for offline-first experience
- **Server-Side Option**: Users can choose cloud-based sync for convenience and cross-device access
- **No Forced Migration**: Both options remain available, giving users control over their data
- **Hybrid Approach**: Users could potentially use multiple persistence layers simultaneously

**Implementation Strategy**:
- **Additive approach**: Server-side storage as additional option, not replacement
- **Real-time sync**: Clients sync RepTree operations and files, not SQL queries
- **User choice**: Users can choose between local-first and server-synced spaces
- **Data integrity** maintained through CRDT-based operation sync

The hybrid SQLite + S3 approach adds a powerful cloud-based sync option to Sila while preserving the existing multi-layer persistence approach (IndexedDB + FileSystem), giving users the flexibility to choose the sync method that best fits their needs.