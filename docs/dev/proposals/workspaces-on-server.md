# Workspaces on Server: Storage Strategy Proposal

## Executive Summary

This proposal explores storing Sila workspaces on servers using the same persistence mechanisms as client-side storage, with a focus on optimizing upload/download performance for cloud storage (S3) operations. We analyze the trade-offs between individual file storage versus compressed archive storage.

## Current Workspace Architecture

### Data Structure
Sila workspaces use a sophisticated CRDT-based architecture:

- **Space Tree**: Root RepTree containing global workspace state (app-configs, app-forest, providers, settings)
- **App Trees**: Individual RepTree instances for specific features (chat conversations, files library)
- **Content-Addressed Storage (CAS)**: Files stored by SHA-256 hash for deduplication
- **Mutable Storage**: UUID-addressed blobs for values that may be updated

### Current Persistence Format
```
<spaceRoot>/
  space-v1/
    ops/                    # CRDT operations (JSONL files)
      <treeId>/
        <year>/<month>/<day>/
          <peerId>.jsonl    # Batched operations by peer and date
    files/
      static/sha256/        # Immutable files by content hash
        <hash[0..1]>/<hash[2..]>
      var/uuid/             # Mutable files by UUID
        <uuid[0..1]>/<uuid[2..]>
    secrets                 # Encrypted secrets file
    space.json              # Space metadata
  sila.md                   # User-facing documentation
```

### Key Characteristics
- **Granular Operations**: Each CRDT operation is stored as a separate JSONL entry
- **Date-based Organization**: Operations are organized by date for efficient querying
- **Content Deduplication**: Identical files stored once by hash
- **Incremental Updates**: New operations appended to existing files
- **File Watching**: Real-time sync via filesystem watching

## Server Storage Options: SQLite Database Files vs Plain Files

### Current Client Storage: IndexedDB

Sila currently uses IndexedDB for client-side workspace storage with the following schema:

```typescript
// IndexedDB Schema (Dexie)
spaces: '&id, uri, name, createdAt, userId'
config: '&key'
treeOps: '&[clock+peerId+treeId+spaceId], spaceId, treeId, [spaceId+treeId], [spaceId+treeId+clock]'
secrets: '&[spaceId+key], spaceId'
```

### Current Server Storage: Plain Files

The current filesystem-based approach stores workspaces as:

```
<spaceRoot>/
  space-v1/
    ops/                    # CRDT operations (JSONL files)
      <treeId>/
        <year>/<month>/<day>/
          <peerId>.jsonl    # Batched operations by peer and date
    files/
      static/sha256/        # Immutable files by content hash
        <hash[0..1]>/<hash[2..]>
      var/uuid/             # Mutable files by UUID
        <uuid[0..1]>/<uuid[2..]>
    secrets                 # Encrypted secrets file
    space.json              # Space metadata
```

### Option 1: SQLite Database Files

**Approach**: Store each workspace as a single SQLite database file containing all operations, metadata, and binary data.

**SQLite Schema**:
```sql
-- Single workspace database file: workspace-<spaceId>.db
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

-- Binary data stored as BLOBs
CREATE TABLE files (
  hash TEXT PRIMARY KEY,
  content BLOB NOT NULL,
  mime_type TEXT,
  size INTEGER
);

CREATE TABLE mutable_files (
  uuid TEXT PRIMARY KEY,
  content BLOB NOT NULL,
  size INTEGER
);

-- Indexes for performance
CREATE INDEX idx_tree_ops_tree ON tree_ops(tree_id);
CREATE INDEX idx_tree_ops_clock ON tree_ops(tree_id, clock);
```

**Advantages**:
- **Single File**: Each workspace is one SQLite database file
- **Atomic Operations**: ACID transactions ensure data consistency
- **Efficient Storage**: SQLite compresses data and handles small files better than filesystem
- **Fast Queries**: Indexed lookups and complex queries supported
- **Simplified Backup**: One file per workspace for easy backup/restore
- **Cross-Platform**: Works identically across all server environments
**Disadvantages**:
- **Single Writer**: SQLite limited to one writer at a time per database
- **File Size Growth**: Database files grow continuously, no automatic cleanup
- **Binary Data in DB**: Large files stored as BLOBs can impact performance
- **No File Watching**: Cannot use filesystem watching for real-time sync
- **Migration Complexity**: Converting from plain files requires data migration

**Performance Characteristics**:
- **Upload**: ~2-10 seconds for entire workspace database
- **Download**: ~1-5 seconds for entire workspace database
- **Query Performance**: ~0.1-1ms for indexed lookups
- **Binary Access**: ~10-50ms for file retrieval from BLOB
- **Concurrent Reads**: Unlimited concurrent read access

### Option 2: Plain Files (Current Approach)

**Approach**: Continue using the current filesystem-based approach with JSONL files for operations and individual files for binary data.

**Advantages**:
- **Granular Access**: Can read/write individual operations or files without downloading entire workspace
- **File Watching**: Real-time sync via filesystem watching
- **Incremental Updates**: Only transfer changed files
- **Content Deduplication**: Identical files stored once by hash
- **Parallel Operations**: Can upload/download multiple files concurrently
- **Selective Loading**: Load only required app trees or date ranges
- **No Migration**: Already implemented and working
- **Transparent Structure**: Easy to debug and inspect

**Disadvantages**:
- **High Latency**: Many small files create significant overhead for S3 operations
- **Cost**: Higher costs due to per-request charges for numerous small files
- **Complexity**: More complex sync logic and conflict resolution
- **Rate Limits**: May hit S3 rate limits with many concurrent operations
- **No Atomicity**: No built-in transaction support across files
- **File System Dependency**: Relies on filesystem structure and permissions

**Performance Characteristics**:
- **Upload**: ~100-500ms per file (S3 PUT overhead)
- **Download**: ~50-200ms per file (S3 GET overhead)
- **Total for 1000 files**: 50-500 seconds (depending on file sizes and concurrency)
- **Query Performance**: ~10-100ms for file-based lookups
- **Binary Access**: ~50-200ms for file retrieval

### Option 3: Compressed Archive Storage

**Approach**: Package entire workspace into a single compressed archive (ZIP) for storage and transfer.

**Advantages**:
- **Fast Transfer**: Single large file transfer is much faster than many small files
- **Cost Effective**: Lower S3 costs due to fewer requests
- **Simple Sync**: Atomic workspace updates with single file operations
- **Compression**: Additional space savings from ZIP compression
- **Reliability**: Fewer points of failure in transfer process

**Disadvantages**:
- **All-or-Nothing**: Must download entire workspace even for small changes
- **Memory Usage**: Requires significant memory to compress/decompress large workspaces
- **No Incremental Updates**: Cannot update individual files without re-archiving
- **No Real-time Sync**: Cannot support live collaboration or file watching
- **Version Conflicts**: Risk of losing concurrent changes during archive updates

**Performance Characteristics**:
- **Upload**: ~2-10 seconds for compressed archive (depending on size)
- **Download**: ~1-5 seconds for compressed archive
- **Compression**: ~20-60% size reduction (depending on content type)

## Direct Comparison: SQLite Database Files vs Plain Files

### Key Differences

| Aspect | SQLite Database Files | Plain Files |
|--------|----------------------|-------------|
| **File Count** | 1 file per workspace | 100-10,000+ files per workspace |
| **Upload Time** | 2-10 seconds | 50-500 seconds |
| **Download Time** | 1-5 seconds | 50-500 seconds |
| **Query Performance** | 0.1-1ms | 10-100ms |
| **Storage Efficiency** | 20-30% better compression | Standard filesystem |
| **Atomicity** | Full ACID transactions | No built-in atomicity |
| **Real-time Sync** | Not supported | File watching supported |
| **Incremental Updates** | Full database transfer | Individual file updates |
| **S3 Costs** | Low (few requests) | High (many requests) |
| **Debugging** | Requires SQL tools | Direct file inspection |
| **Migration** | Complex data migration | No migration needed |

### Performance Analysis

#### Transfer Performance
```
Workspace Size: 100MB, 1000 operations, 500 files

SQLite Database File:
- Upload: 5-15 seconds (single file)
- Download: 3-10 seconds (single file)
- S3 Requests: 2 (PUT + GET)

Plain Files:
- Upload: 300-1500 seconds (500 files)
- Download: 150-750 seconds (500 files)  
- S3 Requests: 1000+ (500 PUT + 500 GET)
```

#### Query Performance
```
Operation: Find all operations for a specific tree in date range

SQLite Database File:
- Query: SELECT * FROM tree_ops WHERE tree_id = ? AND clock BETWEEN ? AND ?
- Time: 0.1-1ms (indexed lookup)

Plain Files:
- Process: Read all JSONL files, parse, filter
- Time: 10-100ms (file I/O + parsing)
```

## Recommendation: Use Case Based Selection

### For Active/Real-time Workspaces: Plain Files
**Use plain files when**:
- Workspace has active collaboration
- Real-time sync is required
- Workspace is frequently accessed
- Incremental updates are common
- File watching is needed

**Benefits**:
- Real-time sync capabilities
- Incremental updates
- Granular access control
- No migration needed

### For Archive/Backup Workspaces: SQLite Database Files
**Use SQLite database files when**:
- Workspace is infrequently accessed
- Full workspace backup/restore is needed
- Query performance is important
- Cost optimization is priority
- Workspace is large (>100MB)

**Benefits**:
- 10-100x faster upload/download
- 90%+ cost reduction on S3
- Atomic operations
- Simplified backup/restore
- Better compression

### Hybrid Strategy

#### Active Tier: Plain Files
- Recent activity (< 7 days)
- Active collaboration
- Real-time sync required
- Small to medium size (< 100MB)

#### Archive Tier: SQLite Database Files  
- Inactive workspaces (> 7 days)
- Large workspaces (> 100MB)
- Backup/restore operations
- Cost optimization priority

#### Migration Strategy
- **Archive Trigger**: Convert to SQLite when workspace becomes inactive
- **Unarchive on Access**: Convert back to plain files when accessed
- **Background Processing**: Handle conversions in background threads

### Implementation Details

#### Storage Structure
```
s3://sila-workspaces/
  active/                    # Plain files (current approach)
    <spaceId>/
      space-v1/
        ops/                 # JSONL files
        files/               # Individual binary files
        secrets
        space.json
  archived/                  # SQLite database files
    <spaceId>/
      workspace.db           # Single SQLite database file
  metadata/                  # Workspace metadata
    <spaceId>.json
```

#### Conversion Process
```typescript
// Convert plain files to SQLite database
async function archiveToSQLite(spaceId: string): Promise<void> {
  // 1. Download all plain files from S3
  const files = await downloadPlainFiles(spaceId);
  
  // 2. Create SQLite database
  const db = new Database(`workspace-${spaceId}.db`);
  
  // 3. Import operations from JSONL files
  for (const jsonlFile of files.ops) {
    const operations = parseJSONL(jsonlFile);
    await db.bulkInsert('tree_ops', operations);
  }
  
  // 4. Import binary files as BLOBs
  for (const file of files.binary) {
    await db.insert('files', {
      hash: file.hash,
      content: file.data,
      mime_type: file.mimeType,
      size: file.size
    });
  }
  
  // 5. Upload SQLite database to S3
  await uploadSQLiteDatabase(spaceId, db);
  
  // 6. Clean up plain files
  await deletePlainFiles(spaceId);
}

// Convert SQLite database back to plain files
async function unarchiveToPlainFiles(spaceId: string): Promise<void> {
  // 1. Download SQLite database from S3
  const db = await downloadSQLiteDatabase(spaceId);
  
  // 2. Export operations to JSONL files
  const operations = await db.getAll('tree_ops');
  await createJSONLFiles(spaceId, operations);
  
  // 3. Export binary files from BLOBs
  const files = await db.getAll('files');
  await createBinaryFiles(spaceId, files);
  
  // 4. Upload plain files to S3
  await uploadPlainFiles(spaceId);
  
  // 5. Clean up SQLite database
  await deleteSQLiteDatabase(spaceId);
}
```

#### API Design
```typescript
interface WorkspaceStorage {
  // Workspace operations (format-agnostic)
  putOperation(treeId: string, operation: VertexOperation): Promise<void>;
  getOperations(treeId: string, dateRange?: DateRange): Promise<VertexOperation[]>;
  putFile(hash: string, content: Uint8Array): Promise<void>;
  getFile(hash: string): Promise<Uint8Array>;
  
  // Format management
  getWorkspaceFormat(spaceId: string): Promise<'plain' | 'sqlite'>;
  convertToSQLite(spaceId: string): Promise<void>;
  convertToPlainFiles(spaceId: string): Promise<void>;
  
  // Workspace lifecycle
  archiveWorkspace(spaceId: string): Promise<void>;
  unarchiveWorkspace(spaceId: string): Promise<void>;
  
  // Sync operations
  syncWorkspace(spaceId: string, localOps: VertexOperation[]): Promise<VertexOperation[]>;
}
```

## Performance Analysis

### Transfer Time Comparison

| Workspace Size | Files | Plain Files | SQLite Database | SQLite Savings |
|----------------|-------|-------------|-----------------|----------------|
| 10MB | 100 | 30-150s | 5-10s | 80-90% |
| 50MB | 500 | 150-750s | 15-30s | 85-95% |
| 100MB | 1000 | 300-1500s | 30-60s | 90-95% |
| 500MB | 5000 | 1500-7500s | 60-120s | 95-98% |

### Query Performance Comparison

| Operation | Plain Files | SQLite Database | Winner |
|-----------|-------------|-----------------|--------|
| Single Operation Lookup | 10-100ms | 0.1-1ms | SQLite (10-100x) |
| Bulk Operations (1000 ops) | 500-2000ms | 10-50ms | SQLite (10-40x) |
| Date Range Queries | 100-1000ms | 1-10ms | SQLite (10-100x) |
| Full Workspace Load | 1000-5000ms | 50-200ms | SQLite (5-25x) |
| Complex Aggregations | Not supported | 1-10ms | SQLite |

### Cost Analysis (S3)

| Storage Type | Requests/Month | Storage (GB) | Transfer (GB) | Monthly Cost |
|--------------|----------------|--------------|---------------|--------------|
| Plain Files | 1M requests | 100GB | 50GB | ~$25-50 |
| SQLite Database | 10K requests | 80GB | 40GB | ~$5-10 |
| Hybrid Approach | 100K requests | 90GB | 45GB | ~$12-20 |

## Security Considerations

### Encryption
- **At Rest**: S3 server-side encryption (SSE-S3 or SSE-KMS)
- **In Transit**: HTTPS/TLS for all transfers
- **Client-Side**: Optional client-side encryption for sensitive workspaces

### Access Control
- **IAM Policies**: Fine-grained access control per workspace
- **Presigned URLs**: Temporary access for specific operations
- **Audit Logging**: Track all workspace access and modifications

### Data Isolation
- **Workspace Isolation**: Each workspace stored in separate S3 prefix
- **User Isolation**: User-specific access controls and encryption keys
- **Version Control**: Maintain workspace version history for recovery

## Implementation Roadmap

### Phase 1: SQLite Archive Support (3-4 weeks)
- [ ] Implement SQLite database file creation from plain files
- [ ] Add conversion utilities (plain files ↔ SQLite)
- [ ] Support SQLite database file upload/download to S3
- [ ] Basic archive/unarchive functionality
- [ ] Integration with existing SpaceManager

### Phase 2: Intelligent Archiving (2-3 weeks)
- [ ] Implement automatic archiving based on workspace activity
- [ ] Background conversion service (plain files → SQLite)
- [ ] Archive/unarchive API endpoints
- [ ] Workspace format detection and routing
- [ ] Migration tools for existing workspaces

### Phase 3: Optimization (2-3 weeks)
- [ ] Performance monitoring and metrics
- [ ] Cost optimization features
- [ ] Advanced sync conflict resolution
- [ ] SQLite query optimization and indexing
- [ ] Background cleanup and maintenance

### Phase 4: Advanced Features (4-6 weeks)
- [ ] Real-time collaboration support
- [ ] Workspace sharing and permissions
- [ ] Backup and recovery tools
- [ ] Analytics and usage tracking

## Recommendations

### Immediate Actions
1. **Keep Plain Files for Active**: Continue using plain files for active workspaces (no migration needed)
2. **Add SQLite for Archives**: Implement SQLite database files for inactive workspaces
3. **Monitor Performance**: Track transfer times, costs, and user experience
4. **Implement Archiving**: Add automatic archiving based on workspace activity

### Long-term Strategy
1. **Hybrid Approach**: Use plain files for active workspaces, SQLite for archives
2. **Smart Caching**: Implement intelligent caching for frequently accessed workspaces
3. **CDN Integration**: Use CloudFront for global workspace distribution
4. **Advanced Sync**: Implement sophisticated conflict resolution for collaborative workspaces
5. **SQLite Optimization**: Leverage SQLite's advanced features for complex queries and analytics

## Conclusion

The hybrid approach using plain files for active workspaces and SQLite database files for archives provides the best balance of performance, cost, and functionality. This strategy leverages the strengths of both approaches while minimizing their weaknesses.

**Key Benefits**:
- **90-95% faster transfers** for archived workspaces through SQLite database files
- **80-90% cost reduction** compared to pure plain file storage
- **Maintained real-time sync** capabilities for active workspaces
- **Advanced query capabilities** through SQL for archived workspaces
- **No migration needed** for existing active workspaces
- **Scalable architecture** that grows with user base and workspace sizes

**SQLite Database Files vs Plain Files**:
- **Transfer Performance**: 10-100x faster upload/download for large workspaces
- **Query Performance**: 10-100x faster for complex operations and lookups
- **Storage Efficiency**: 20-30% better compression and space utilization
- **Cost Optimization**: 80-90% reduction in S3 request costs
- **Atomicity**: Full ACID transactions vs no built-in atomicity
- **Real-time Sync**: Not supported vs full file watching support

**Recommendation**:
- **Active Workspaces**: Keep using plain files (no migration needed)
- **Archive Workspaces**: Convert to SQLite database files for efficiency
- **Automatic Conversion**: Archive inactive workspaces to SQLite after 7+ days
- **On-demand Unarchive**: Convert back to plain files when workspace is accessed

The implementation should start by adding SQLite archive support while keeping the existing plain file system for active workspaces.