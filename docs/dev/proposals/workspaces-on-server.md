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

### Option 2: Compressed Archive Storage

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

## Hybrid Approach: Smart Archiving

### Proposed Solution

Combine both approaches with intelligent archiving based on workspace characteristics:

#### 1. **Active Workspaces** (Individual Files)
- Workspaces with recent activity (< 7 days)
- Workspaces with active collaboration
- Small workspaces (< 100MB total)
- Use individual file storage for real-time sync capabilities

#### 2. **Archived Workspaces** (Compressed Archives)
- Inactive workspaces (> 7 days without changes)
- Large workspaces (> 100MB total)
- Workspaces with many small files (> 1000 files)
- Use compressed archive storage for efficiency

#### 3. **Migration Strategy**
- **Archive Trigger**: Automatically archive workspaces when they become inactive
- **Unarchive on Access**: Convert back to individual files when workspace is accessed
- **Background Processing**: Handle archiving/unarchiving in background threads

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
  active/                    # Individual file storage
    <spaceId>/
      space-v1/
        ops/
        files/
        secrets
  archived/                  # Compressed archives
    <spaceId>/
      workspace-<timestamp>.zip
  metadata/                  # Workspace metadata
    <spaceId>.json
```

#### API Design
```typescript
interface WorkspaceStorage {
  // Individual file operations (for active workspaces)
  putOperation(treeId: string, operation: VertexOperation): Promise<void>;
  getOperations(treeId: string, dateRange?: DateRange): Promise<VertexOperation[]>;
  putFile(hash: string, content: Uint8Array): Promise<void>;
  getFile(hash: string): Promise<Uint8Array>;
  
  // Archive operations
  archiveWorkspace(spaceId: string): Promise<void>;
  unarchiveWorkspace(spaceId: string): Promise<void>;
  isArchived(spaceId: string): Promise<boolean>;
  
  // Hybrid operations
  getWorkspace(spaceId: string): Promise<WorkspaceData>;
  syncWorkspace(spaceId: string, localOps: VertexOperation[]): Promise<VertexOperation[]>;
}
```

## Performance Analysis

### Transfer Time Comparison

| Workspace Size | Files | Individual Files | Compressed Archive | Savings |
|----------------|-------|------------------|-------------------|---------|
| 10MB | 100 | 30-150s | 2-5s | 85-95% |
| 50MB | 500 | 150-750s | 5-15s | 90-95% |
| 100MB | 1000 | 300-1500s | 10-30s | 90-95% |
| 500MB | 5000 | 1500-7500s | 30-90s | 95-98% |

### Cost Analysis (S3)

| Storage Type | Requests/Month | Storage (GB) | Transfer (GB) | Monthly Cost |
|--------------|----------------|--------------|---------------|--------------|
| Individual Files | 1M requests | 100GB | 50GB | ~$25-50 |
| Compressed Archives | 1K requests | 80GB | 40GB | ~$8-15 |
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

### Phase 1: Basic Server Storage (4-6 weeks)
- [ ] Implement S3-based persistence layer
- [ ] Support individual file storage for active workspaces
- [ ] Basic workspace upload/download functionality
- [ ] Integration with existing SpaceManager

### Phase 2: Archive System (3-4 weeks)
- [ ] Implement workspace archiving logic
- [ ] Background archiving service
- [ ] Archive/unarchive API endpoints
- [ ] Migration tools for existing workspaces

### Phase 3: Optimization (2-3 weeks)
- [ ] Intelligent archiving based on workspace characteristics
- [ ] Performance monitoring and metrics
- [ ] Cost optimization features
- [ ] Advanced sync conflict resolution

### Phase 4: Advanced Features (4-6 weeks)
- [ ] Real-time collaboration support
- [ ] Workspace sharing and permissions
- [ ] Backup and recovery tools
- [ ] Analytics and usage tracking

## Recommendations

### Immediate Actions
1. **Start with Individual Files**: Implement S3 persistence layer using individual file storage for active workspaces
2. **Monitor Performance**: Track transfer times, costs, and user experience
3. **Implement Archiving**: Add archive functionality for inactive workspaces
4. **Optimize Based on Data**: Use real usage patterns to refine archiving thresholds

### Long-term Strategy
1. **Hybrid Approach**: Use the proposed hybrid model for optimal performance and cost
2. **Smart Caching**: Implement intelligent caching for frequently accessed workspaces
3. **CDN Integration**: Use CloudFront for global workspace distribution
4. **Advanced Sync**: Implement sophisticated conflict resolution for collaborative workspaces

## Conclusion

The hybrid approach combining individual file storage for active workspaces with compressed archives for inactive ones provides the best balance of performance, cost, and functionality. This strategy leverages the strengths of both approaches while minimizing their weaknesses.

**Key Benefits**:
- **90-95% faster transfers** for large workspaces through archiving
- **60-80% cost reduction** compared to pure individual file storage
- **Maintained real-time sync** capabilities for active workspaces
- **Scalable architecture** that grows with user base and workspace sizes

The implementation should start with individual file storage and gradually introduce archiving based on real usage patterns and performance requirements.