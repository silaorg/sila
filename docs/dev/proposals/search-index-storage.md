# Search Index Storage in Sila Workspaces

## Overview

This document explores how to leverage Sila's existing FileStore system for storing search indices. The FileStore provides both immutable (content-addressed) and mutable (UUID-addressed) storage capabilities that are perfect for different types of search data.

## FileStore Architecture Analysis

### Current FileStore Capabilities

The FileStore provides two distinct storage mechanisms:

1. **Immutable Storage (CAS - Content Addressed Storage)**
   - Files identified by SHA256 hash
   - Path: `space-v1/files/static/sha256/{prefix}/{rest}`
   - Used for: User files, attachments, content that doesn't change
   - Methods: `putBytes()`, `getBytes()`, `exists()`, `delete()`

2. **Mutable Storage (UUID-addressed)**
   - Files identified by UUID
   - Path: `space-v1/files/var/uuid/{prefix}/{suffix}`
   - Used for: Search indices, temporary data, editable content
   - Methods: `putMutable()`, `getMutable()`, `existsMutable()`, `deleteMutable()`

### Directory Structure

```
space-v1/
├── ops/                          # Tree operations
│   └── {treeId}/
│       └── {year}/{month}/{day}/
├── files/
│   ├── static/sha256/            # Immutable files (user content)
│   │   └── {prefix}/{rest}
│   └── var/uuid/                 # Mutable files (search indices)
│       └── {prefix}/{suffix}
└── space.json                    # Space metadata
```

## Search Index Storage Strategy

### 1. Mutable Storage for Search Indices

Search indices are perfect candidates for mutable storage because:
- They need to be updated incrementally
- They're workspace-specific and not shared
- They can be regenerated if needed
- They change as content is added/modified

### 2. Proposed Index Structure

```
space-v1/files/var/uuid/
├── {search-index-uuid}/          # Main search index
├── {bm25-index-uuid}/           # BM25 index data
├── {vector-db-uuid}/            # Vector database
├── {embedding-model-uuid}/      # Embedding model cache
└── {search-config-uuid}/        # Search configuration
```

### 3. Index Components

#### A. BM25 Index Storage
```typescript
interface BM25IndexData {
  version: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
  totalTerms: number;
  indexData: {
    // wink-bm25-text-search serialized data
    documents: Array<{
      id: string;
      text: string;
      terms: Record<string, number>;
    }>;
    vocabulary: Record<string, number>;
    documentFrequencies: Record<string, number>;
  };
  settings: {
    k1: number;
    b: number;
    minTermLength: number;
  };
}
```

#### B. Vector Database Storage
```typescript
interface VectorIndexData {
  version: string;
  createdAt: string;
  updatedAt: string;
  vectorCount: number;
  dimensions: number;
  model: {
    name: string;
    version: string;
    dimensions: number;
  };
  vectors: Array<{
    id: string;           // Resource:chunk ID
    vector: number[];      // Embedding vector
    metadata: {
      rid: string;
      cid: string;
      text: string;
      type: string;
    };
  }>;
}
```

#### C. Search Configuration
```typescript
interface SearchConfig {
  version: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    chunkSize: number;
    chunkOverlap: number;
    maxResults: number;
    hybridWeight: number;
    mmrLambda: number;
  };
  models: {
    embedding: {
      name: string;
      provider: string;
      dimensions: number;
    };
    reranker?: {
      name: string;
      provider: string;
    };
  };
  indexing: {
    lastIndexed: string;
    totalResources: number;
    totalChunks: number;
  };
}
```

## Implementation Design

### 1. SearchIndexStorage Class

```typescript
export class SearchIndexStorage {
  constructor(
    private fileStore: FileStore,
    private spaceId: string
  ) {
    this.initializeIndexUUIDs();
  }

  private indexUUIDs = {
    bm25: 'search-bm25-index',
    vectors: 'search-vector-index', 
    config: 'search-config',
    model: 'search-embedding-model'
  };

  // BM25 Index Operations
  async saveBM25Index(indexData: BM25IndexData): Promise<void> {
    const serialized = JSON.stringify(indexData, null, 2);
    const bytes = new TextEncoder().encode(serialized);
    await this.fileStore.putMutable(this.indexUUIDs.bm25, bytes);
  }

  async loadBM25Index(): Promise<BM25IndexData | null> {
    if (!(await this.fileStore.existsMutable(this.indexUUIDs.bm25))) {
      return null;
    }
    
    const bytes = await this.fileStore.getMutable(this.indexUUIDs.bm25);
    const serialized = new TextDecoder().decode(bytes);
    return JSON.parse(serialized);
  }

  // Vector Index Operations
  async saveVectorIndex(vectorData: VectorIndexData): Promise<void> {
    const serialized = JSON.stringify(vectorData, null, 2);
    const bytes = new TextEncoder().encode(serialized);
    await this.fileStore.putMutable(this.indexUUIDs.vectors, bytes);
  }

  async loadVectorIndex(): Promise<VectorIndexData | null> {
    if (!(await this.fileStore.existsMutable(this.indexUUIDs.vectors))) {
      return null;
    }
    
    const bytes = await this.fileStore.getMutable(this.indexUUIDs.vectors);
    const serialized = new TextDecoder().decode(bytes);
    return JSON.parse(serialized);
  }

  // Configuration Operations
  async saveConfig(config: SearchConfig): Promise<void> {
    const serialized = JSON.stringify(config, null, 2);
    const bytes = new TextEncoder().encode(serialized);
    await this.fileStore.putMutable(this.indexUUIDs.config, bytes);
  }

  async loadConfig(): Promise<SearchConfig | null> {
    if (!(await this.fileStore.existsMutable(this.indexUUIDs.config))) {
      return null;
    }
    
    const bytes = await this.fileStore.getMutable(this.indexUUIDs.config);
    const serialized = new TextDecoder().decode(bytes);
    return JSON.parse(serialized);
  }

  // Index Management
  async clearAllIndices(): Promise<void> {
    const uuids = Object.values(this.indexUUIDs);
    for (const uuid of uuids) {
      if (await this.fileStore.existsMutable(uuid)) {
        await this.fileStore.deleteMutable(uuid);
      }
    }
  }

  async getIndexStatus(): Promise<IndexStatus> {
    const status: IndexStatus = {
      bm25: await this.fileStore.existsMutable(this.indexUUIDs.bm25),
      vectors: await this.fileStore.existsMutable(this.indexUUIDs.vectors),
      config: await this.fileStore.existsMutable(this.indexUUIDs.config),
      model: await this.fileStore.existsMutable(this.indexUUIDs.model)
    };
    
    return status;
  }
}
```

### 2. Integration with SearchIndexManager

```typescript
export class SearchIndexManager {
  private storage: SearchIndexStorage;
  private bm25Index: any;
  private vectorStore: VectorStore;

  constructor(
    private space: Space,
    private fileStore: FileStore
  ) {
    this.storage = new SearchIndexStorage(fileStore, space.getId());
  }

  async initialize(): Promise<void> {
    // Load existing indices
    await this.loadBM25Index();
    await this.loadVectorIndex();
    await this.loadConfiguration();
  }

  private async loadBM25Index(): Promise<void> {
    const indexData = await this.storage.loadBM25Index();
    if (indexData) {
      // Reconstruct BM25 index from stored data
      this.bm25Index = this.reconstructBM25Index(indexData);
    } else {
      // Initialize new BM25 index
      this.bm25Index = new BM25TextSearch();
    }
  }

  private async loadVectorIndex(): Promise<void> {
    const vectorData = await this.storage.loadVectorIndex();
    if (vectorData) {
      // Reconstruct vector store from stored data
      this.vectorStore = this.reconstructVectorStore(vectorData);
    } else {
      // Initialize new vector store
      this.vectorStore = new VectorStore();
    }
  }

  async saveIndices(): Promise<void> {
    // Save BM25 index
    if (this.bm25Index) {
      const bm25Data = this.serializeBM25Index();
      await this.storage.saveBM25Index(bm25Data);
    }

    // Save vector index
    if (this.vectorStore) {
      const vectorData = this.serializeVectorIndex();
      await this.storage.saveVectorIndex(vectorData);
    }
  }
}
```

### 3. Incremental Updates

```typescript
export class IncrementalIndexer {
  constructor(
    private indexManager: SearchIndexManager,
    private storage: SearchIndexStorage
  ) {}

  async updateResource(resource: SearchResource): Promise<void> {
    // Update BM25 index
    await this.updateBM25ForResource(resource);
    
    // Update vector index
    await this.updateVectorsForResource(resource);
    
    // Save updated indices
    await this.indexManager.saveIndices();
  }

  async removeResource(rid: string): Promise<void> {
    // Remove from BM25 index
    await this.removeFromBM25(rid);
    
    // Remove from vector index
    await this.removeFromVectors(rid);
    
    // Save updated indices
    await this.indexManager.saveIndices();
  }
}
```

## Benefits of This Approach

### 1. Leverages Existing Infrastructure
- Uses proven FileStore system
- Follows established patterns
- Integrates with existing persistence layer

### 2. Efficient Storage
- Mutable storage perfect for search indices
- UUID-based addressing for easy updates
- Automatic directory structure management

### 3. Cross-Platform Compatibility
- Works in both browser and Node.js
- Uses standard file system operations
- No external dependencies for storage

### 4. Incremental Updates
- Can update indices incrementally
- No need to rebuild entire index
- Efficient for large workspaces

### 5. Backup and Sync
- Indices stored alongside workspace data
- Automatic backup with workspace
- Sync with workspace across devices

## Performance Considerations

### 1. Index Size Management
```typescript
interface IndexSizeInfo {
  bm25Size: number;      // Size in bytes
  vectorSize: number;     // Size in bytes
  totalSize: number;      // Combined size
  lastUpdated: string;    // Last update timestamp
}

async getIndexSizeInfo(): Promise<IndexSizeInfo> {
  // Calculate index sizes
  const bm25Exists = await this.storage.fileStore.existsMutable(this.storage.indexUUIDs.bm25);
  const vectorExists = await this.storage.fileStore.existsMutable(this.storage.indexUUIDs.vectors);
  
  let bm25Size = 0;
  let vectorSize = 0;
  
  if (bm25Exists) {
    const bm25Data = await this.storage.fileStore.getMutable(this.storage.indexUUIDs.bm25);
    bm25Size = bm25Data.length;
  }
  
  if (vectorExists) {
    const vectorData = await this.storage.fileStore.getMutable(this.storage.indexUUIDs.vectors);
    vectorSize = vectorData.length;
  }
  
  return {
    bm25Size,
    vectorSize,
    totalSize: bm25Size + vectorSize,
    lastUpdated: new Date().toISOString()
  };
}
```

### 2. Compression
```typescript
async saveCompressedIndex(indexData: any, uuid: string): Promise<void> {
  // Compress large indices before storage
  const serialized = JSON.stringify(indexData);
  const compressed = await this.compress(serialized);
  await this.fileStore.putMutable(uuid, compressed);
}

async loadCompressedIndex(uuid: string): Promise<any> {
  const compressed = await this.fileStore.getMutable(uuid);
  const decompressed = await this.decompress(compressed);
  return JSON.parse(decompressed);
}
```

### 3. Lazy Loading
```typescript
class LazySearchIndexManager {
  private bm25Index: any | null = null;
  private vectorStore: VectorStore | null = null;

  async getBM25Index(): Promise<any> {
    if (!this.bm25Index) {
      await this.loadBM25Index();
    }
    return this.bm25Index;
  }

  async getVectorStore(): Promise<VectorStore> {
    if (!this.vectorStore) {
      await this.loadVectorIndex();
    }
    return this.vectorStore;
  }
}
```

## Migration Strategy

### 1. Version Management
```typescript
interface IndexVersion {
  version: string;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
}

async migrateIndexIfNeeded(): Promise<void> {
  const config = await this.storage.loadConfig();
  if (!config || config.version !== CURRENT_INDEX_VERSION) {
    // Perform migration
    await this.migrateToCurrentVersion(config);
  }
}
```

### 2. Backward Compatibility
```typescript
async loadLegacyIndex(): Promise<void> {
  // Check for legacy index format
  const legacyIndex = await this.findLegacyIndex();
  if (legacyIndex) {
    // Convert legacy format to new format
    const newIndex = await this.convertLegacyIndex(legacyIndex);
    await this.storage.saveBM25Index(newIndex);
  }
}
```

## Security Considerations

### 1. Access Control
- Search indices inherit workspace access controls
- No external access to search data
- Local storage only

### 2. Data Privacy
- All search data stays within workspace
- No external API calls for storage
- Encrypted if workspace is encrypted

### 3. Index Integrity
```typescript
async validateIndexIntegrity(): Promise<boolean> {
  try {
    const bm25Data = await this.storage.loadBM25Index();
    const vectorData = await this.storage.loadVectorIndex();
    
    // Validate data structure
    return this.validateBM25Data(bm25Data) && this.validateVectorData(vectorData);
  } catch (error) {
    console.error('Index integrity check failed:', error);
    return false;
  }
}
```

## Conclusion

Using Sila's FileStore for search index storage provides:

1. **Seamless Integration**: Leverages existing infrastructure
2. **Efficient Updates**: Mutable storage perfect for search indices
3. **Cross-Platform**: Works everywhere Sila works
4. **Reliable**: Proven storage system
5. **Scalable**: Can handle large indices efficiently

This approach ensures that search functionality becomes a natural part of the Sila workspace experience while maintaining the privacy and performance characteristics that make Sila unique.