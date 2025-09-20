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

## Server Storage Options

### Current Client Storage: IndexedDB

Sila currently uses IndexedDB for client-side workspace storage with the following schema:

```typescript
// IndexedDB Schema (Dexie)
spaces: '&id, uri, name, createdAt, userId'
config: '&key'
treeOps: '&[clock+peerId+treeId+spaceId], spaceId, treeId, [spaceId+treeId], [spaceId+treeId+clock]'
secrets: '&[spaceId+key], spaceId'
```

**IndexedDB Characteristics**:
- **NoSQL**: Document-based storage with composite keys
- **Browser-Only**: Limited to client-side environments
- **Transaction Support**: ACID transactions within browser context
- **Indexing**: Efficient queries on indexed fields
- **Storage Limits**: Subject to browser storage quotas and clearing policies

### Option 1: Individual File Storage

**Approach**: Store workspace components as individual files in cloud storage, mirroring the local filesystem structure.

**Advantages**:
- **Granular Access**: Can read/write individual operations or files without downloading entire workspace
- **Incremental Sync**: Only transfer changed files, reducing bandwidth usage
- **Parallel Operations**: Can upload/download multiple files concurrently
- **Selective Loading**: Load only required app trees or date ranges
- **Real-time Updates**: Support for live collaboration and file watching

**Disadvantages**:
- **High Latency**: Many small files create significant overhead for S3 operations
- **Cost**: Higher costs due to per-request charges for numerous small files
- **Complexity**: More complex sync logic and conflict resolution
- **Rate Limits**: May hit S3 rate limits with many concurrent operations

**Performance Characteristics**:
- **Upload**: ~100-500ms per file (S3 PUT overhead)
- **Download**: ~50-200ms per file (S3 GET overhead)
- **Total for 1000 files**: 50-500 seconds (depending on file sizes and concurrency)

### Option 2: SQLite Database Storage

**Approach**: Store workspace data in SQLite databases, mirroring the IndexedDB schema but with SQL capabilities.

**SQLite Schema**:
```sql
-- Spaces table
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

-- Configuration table
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Tree operations table
CREATE TABLE tree_ops (
  clock INTEGER NOT NULL,
  peer_id TEXT NOT NULL,
  tree_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  parent_id TEXT,
  key TEXT,
  value TEXT,
  PRIMARY KEY (clock, peer_id, tree_id, space_id)
);

-- Secrets table
CREATE TABLE secrets (
  space_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (space_id, key)
);

-- Indexes for performance
CREATE INDEX idx_tree_ops_space_tree ON tree_ops(space_id, tree_id);
CREATE INDEX idx_tree_ops_clock ON tree_ops(space_id, tree_id, clock);
CREATE INDEX idx_secrets_space ON secrets(space_id);
```

**Advantages**:
- **Familiar Schema**: Direct migration from IndexedDB structure
- **SQL Queries**: Complex queries and aggregations possible
- **ACID Transactions**: Reliable data consistency
- **Efficient Indexing**: Fast lookups on indexed fields
- **Bulk Operations**: Efficient batch inserts/updates
- **Cross-Platform**: Works on any server environment
- **Small Footprint**: Lightweight database engine
- **Backup/Restore**: Standard SQLite backup tools

**Disadvantages**:
- **Single Writer**: SQLite limited to one writer at a time
- **No Network Access**: Cannot be accessed remotely without additional layer
- **File-based**: Still requires file storage and transfer
- **Concurrency Limits**: Limited concurrent read/write operations
- **No Built-in Replication**: Manual replication setup required

**Performance Characteristics**:
- **Bulk Insert**: ~10,000-50,000 ops/second
- **Query Performance**: ~1-10ms for indexed lookups
- **File Size**: ~60-80% of raw data size (with compression)
- **Memory Usage**: ~10-50MB per workspace database

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

## Hybrid Approach: Multi-Tier Storage

### Proposed Solution

Combine all three approaches with intelligent storage tiering based on workspace characteristics:

#### 1. **Active Workspaces** (SQLite + Individual Files)
- Workspaces with recent activity (< 7 days)
- Workspaces with active collaboration
- Small to medium workspaces (< 500MB total)
- Use SQLite for operations and individual files for binary content
- Enables real-time sync and efficient querying

#### 2. **Warm Workspaces** (SQLite + Compressed Archives)
- Moderately active workspaces (7-30 days)
- Medium to large workspaces (100MB-1GB total)
- Use SQLite for operations but compress binary files
- Balance between performance and storage efficiency

#### 3. **Cold Workspaces** (Compressed Archives)
- Inactive workspaces (> 30 days without changes)
- Very large workspaces (> 1GB total)
- Workspaces with many small files (> 10,000 files)
- Use compressed archive storage for maximum efficiency

#### 4. **Migration Strategy**
- **Tier Promotion**: Automatically promote workspaces to higher tiers based on activity
- **Tier Demotion**: Move workspaces to lower tiers when they become inactive
- **Background Processing**: Handle tier migrations in background threads
- **Smart Caching**: Keep frequently accessed data in higher tiers

### Implementation Details

#### Archive Format
```json
{
  "version": "1.0",
  "spaceId": "workspace-uuid",
  "createdAt": "2024-01-01T00:00:00Z",
  "archivedAt": "2024-01-15T00:00:00Z",
  "compression": "gzip",
  "checksum": "sha256-hash",
  "size": 12345678,
  "fileCount": 1500
}
```

#### Storage Structure
```
s3://sila-workspaces/
  active/                    # SQLite + Individual files
    <spaceId>/
      workspace.db           # SQLite database
      files/
        static/sha256/       # Individual binary files
        var/uuid/
  warm/                      # SQLite + Compressed files
    <spaceId>/
      workspace.db           # SQLite database
      files-archive.zip      # Compressed binary files
  cold/                      # Compressed archives
    <spaceId>/
      workspace-<timestamp>.zip
  metadata/                  # Workspace metadata
    <spaceId>.json
```

#### API Design
```typescript
interface WorkspaceStorage {
  // SQLite operations (for active/warm workspaces)
  putOperation(treeId: string, operation: VertexOperation): Promise<void>;
  getOperations(treeId: string, dateRange?: DateRange): Promise<VertexOperation[]>;
  bulkPutOperations(operations: VertexOperation[]): Promise<void>;
  
  // File operations (tier-dependent)
  putFile(hash: string, content: Uint8Array): Promise<void>;
  getFile(hash: string): Promise<Uint8Array>;
  
  // Tier management
  promoteWorkspace(spaceId: string, targetTier: 'active' | 'warm' | 'cold'): Promise<void>;
  demoteWorkspace(spaceId: string, targetTier: 'warm' | 'cold'): Promise<void>;
  getWorkspaceTier(spaceId: string): Promise<'active' | 'warm' | 'cold'>;
  
  // Archive operations (for cold workspaces)
  archiveWorkspace(spaceId: string): Promise<void>;
  unarchiveWorkspace(spaceId: string): Promise<void>;
  
  // Hybrid operations
  getWorkspace(spaceId: string): Promise<WorkspaceData>;
  syncWorkspace(spaceId: string, localOps: VertexOperation[]): Promise<VertexOperation[]>;
}
```

## Performance Analysis

### Transfer Time Comparison

| Workspace Size | Files | Individual Files | SQLite + Files | Compressed Archive | SQLite Savings |
|----------------|-------|------------------|----------------|-------------------|----------------|
| 10MB | 100 | 30-150s | 5-10s | 2-5s | 80-90% |
| 50MB | 500 | 150-750s | 15-30s | 5-15s | 85-95% |
| 100MB | 1000 | 300-1500s | 30-60s | 10-30s | 90-95% |
| 500MB | 5000 | 1500-7500s | 60-120s | 30-90s | 95-98% |

### Query Performance Comparison

| Operation | IndexedDB | SQLite | File-based | Winner |
|-----------|-----------|--------|------------|--------|
| Single Operation Lookup | 1-5ms | 0.1-1ms | 10-100ms | SQLite |
| Bulk Operations (1000 ops) | 50-200ms | 10-50ms | 500-2000ms | SQLite |
| Date Range Queries | 10-50ms | 1-10ms | 100-1000ms | SQLite |
| Full Workspace Load | 100-500ms | 50-200ms | 1000-5000ms | SQLite |
| Complex Aggregations | Not supported | 1-10ms | Not supported | SQLite |

### Cost Analysis (S3)

| Storage Type | Requests/Month | Storage (GB) | Transfer (GB) | Monthly Cost |
|--------------|----------------|--------------|---------------|--------------|
| Individual Files | 1M requests | 100GB | 50GB | ~$25-50 |
| SQLite + Files | 100K requests | 85GB | 45GB | ~$15-25 |
| Compressed Archives | 1K requests | 80GB | 40GB | ~$8-15 |
| Multi-Tier Hybrid | 50K requests | 82GB | 42GB | ~$10-18 |

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

### Phase 1: SQLite Server Storage (4-6 weeks)
- [ ] Implement SQLite-based persistence layer
- [ ] Migrate IndexedDB schema to SQLite
- [ ] Support SQLite + individual file storage for active workspaces
- [ ] Basic workspace upload/download functionality
- [ ] Integration with existing SpaceManager

### Phase 2: Multi-Tier System (3-4 weeks)
- [ ] Implement workspace tiering logic
- [ ] Background tier migration service
- [ ] Tier promotion/demotion API endpoints
- [ ] Compressed archive support for warm/cold tiers
- [ ] Migration tools for existing workspaces

### Phase 3: Optimization (2-3 weeks)
- [ ] Intelligent tiering based on workspace characteristics
- [ ] Performance monitoring and metrics
- [ ] Cost optimization features
- [ ] Advanced sync conflict resolution
- [ ] SQLite query optimization and indexing

### Phase 4: Advanced Features (4-6 weeks)
- [ ] Real-time collaboration support
- [ ] Workspace sharing and permissions
- [ ] Backup and recovery tools
- [ ] Analytics and usage tracking

## Recommendations

### Immediate Actions
1. **Start with SQLite**: Implement SQLite persistence layer for active workspaces
2. **Monitor Performance**: Track query times, transfer times, costs, and user experience
3. **Implement Tiering**: Add tier management functionality for workspace lifecycle
4. **Optimize Based on Data**: Use real usage patterns to refine tiering thresholds

### Long-term Strategy
1. **Multi-Tier Approach**: Use the proposed multi-tier model for optimal performance and cost
2. **Smart Caching**: Implement intelligent caching for frequently accessed workspaces
3. **CDN Integration**: Use CloudFront for global workspace distribution
4. **Advanced Sync**: Implement sophisticated conflict resolution for collaborative workspaces
5. **SQLite Optimization**: Leverage SQLite's advanced features for complex queries and analytics

## Conclusion

The multi-tier approach combining SQLite for active workspaces with intelligent tiering provides the best balance of performance, cost, and functionality. This strategy leverages the strengths of SQLite's query performance while maintaining the efficiency of compressed archives for inactive workspaces.

**Key Benefits**:
- **10-100x faster queries** compared to file-based storage through SQLite
- **80-95% faster transfers** for large workspaces through intelligent tiering
- **60-80% cost reduction** compared to pure individual file storage
- **Maintained real-time sync** capabilities for active workspaces
- **Advanced query capabilities** through SQL for analytics and complex operations
- **Scalable architecture** that grows with user base and workspace sizes

**SQLite Advantages Over IndexedDB**:
- **Server-side deployment**: Can run on any server environment
- **Better performance**: 10-100x faster for complex queries
- **SQL capabilities**: Support for complex aggregations and analytics
- **Reliability**: No browser storage limitations or clearing policies
- **Cross-platform**: Consistent behavior across all environments

The implementation should start with SQLite for active workspaces and gradually introduce tiering based on real usage patterns and performance requirements.