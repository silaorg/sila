# Search in Sila Workspaces

## Overview

This proposal outlines the implementation of a hybrid search system for Sila workspaces that combines BM25 (keyword) and semantic (embedding-based) search capabilities. The system will be designed to work seamlessly with Sila's existing workspace architecture, file storage system, and cross-platform compatibility requirements.

## Goals

- **Unified Search Experience**: Enable users to search across all content types in their workspaces (chats, files, documents, etc.)
- **Hybrid Search**: Combine keyword-based (BM25) and semantic search for optimal results
- **Cross-Platform**: Work in both browser and Node.js environments
- **Performance**: Fast, responsive search with efficient indexing
- **Privacy**: Keep search indices local to the workspace
- **Extensibility**: Support for different content types and search strategies

## Architecture Overview

### Core Components

1. **Search Index Manager**: Manages search indices and coordinates between different search backends
2. **Content Indexer**: Processes and indexes content from various sources
3. **Hybrid Search Engine**: Combines BM25 and semantic search results
4. **Search API**: Provides unified search interface for the UI

### Integration with Existing Sila Architecture

The search system will integrate with Sila's existing components:

- **Space**: Leverage the existing `Space` class for workspace management
- **FileStore**: Use the mutable file storage system for search indices
- **Persistence Layer**: Store search indices alongside workspace data
- **App Trees**: Index content from different app types (chat, files, etc.)

## Technical Implementation

### Data Model

```typescript
interface SearchResource {
  rid: string;                    // Resource ID (e.g., "@chat/123", "@file/456")
  title?: string;                 // Resource title
  type: 'chat' | 'file' | 'document' | 'message';
  workspace: string;              // Workspace ID
  visibility: string[];          // Access control
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  chunks: SearchChunk[];         // Searchable chunks
}

interface SearchChunk {
  cid: string;                   // Chunk ID within resource
  text: string;                  // Display text
  normText: string;             // Normalized text for BM25
  headingPath?: string[];       // Document structure
  startChar?: number;            // Character offsets
  endChar?: number;
  vector?: number[];            // Embedding vector
  metadata?: Record<string, any>; // Additional metadata
}
```

### Search Index Structure

Search indices will be stored in the workspace's mutable file storage:

```
space-v1/
├── search/
│   ├── indices/
│   │   ├── bm25.json           # BM25 index
│   │   ├── vectors.db          # SQLite database for vectors
│   │   └── metadata.json       # Index metadata
│   ├── embeddings/
│   │   └── model.json          # Embedding model info
│   └── config.json             # Search configuration
```

### Dependencies

```json
{
  "dependencies": {
    "wink-bm25-text-search": "^2.0.0",
    "vectordb": "^0.1.0",
    "transformers.js": "^2.0.0",
    "sqlite3": "^5.1.0",
    "natural": "^6.0.0"
  }
}
```

### Core Implementation

#### 1. Search Index Manager

```typescript
export class SearchIndexManager {
  private bm25Index: any;
  private vectorStore: VectorStore;
  private sqliteDb: Database;
  private embeddingModel: any;
  
  constructor(
    private space: Space,
    private fileStore: FileStore
  ) {
    this.initializeIndices();
  }
  
  async indexResource(resource: SearchResource): Promise<void> {
    // Index for BM25
    await this.indexForBM25(resource);
    
    // Generate embeddings and index for semantic search
    await this.indexForSemantic(resource);
  }
  
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // Perform hybrid search
    const bm25Results = await this.searchBM25(query, options);
    const semanticResults = await this.searchSemantic(query, options);
    
    // Combine and rank results
    return this.combineResults(bm25Results, semanticResults, options);
  }
}
```

#### 2. Content Indexer

```typescript
export class ContentIndexer {
  constructor(
    private space: Space,
    private indexManager: SearchIndexManager
  ) {}
  
  async indexWorkspace(): Promise<void> {
    // Index chat conversations
    await this.indexChats();
    
    // Index files
    await this.indexFiles();
    
    // Index other content types
    await this.indexDocuments();
  }
  
  private async indexChats(): Promise<void> {
    const appTreeIds = this.space.getAppTreeIds();
    
    for (const treeId of appTreeIds) {
      const appTree = await this.space.loadAppTree(treeId);
      if (appTree?.getAppId() === 'default-chat') {
        await this.indexChatTree(appTree);
      }
    }
  }
  
  private async indexFiles(): Promise<void> {
    const filesAppTree = await FilesAppData.getOrCreateDefaultFilesTree(this.space);
    const filesData = new FilesAppData(this.space, filesAppTree);
    
    for (const fileVertex of filesData.fileVertices) {
      await this.indexFile(fileVertex);
    }
  }
}
```

#### 3. Hybrid Search Engine

```typescript
export class HybridSearchEngine {
  async search(
    query: string, 
    options: SearchOptions
  ): Promise<SearchResult[]> {
    // Preprocess query
    const normalizedQuery = this.normalizeQuery(query);
    
    // Perform BM25 search
    const bm25Results = await this.bm25Search(normalizedQuery, options);
    
    // Perform semantic search
    const semanticResults = await this.semanticSearch(query, options);
    
    // Combine results using RRF (Reciprocal Rank Fusion)
    const combinedResults = this.combineWithRRF(bm25Results, semanticResults);
    
    // Apply MMR diversification
    const diversifiedResults = this.applyMMR(combinedResults, options);
    
    // Apply field boosts and filters
    return this.applyBoostsAndFilters(diversifiedResults, options);
  }
  
  private combineWithRRF(
    bm25Results: SearchResult[], 
    semanticResults: SearchResult[]
  ): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();
    
    // Add BM25 results with RRF scoring
    bm25Results.forEach((result, index) => {
      const rrfScore = 1 / (60 + index + 1); // k=60 for RRF
      resultMap.set(result.rid, { ...result, bm25Score: rrfScore });
    });
    
    // Add semantic results with RRF scoring
    semanticResults.forEach((result, index) => {
      const rrfScore = 1 / (60 + index + 1);
      const existing = resultMap.get(result.rid);
      if (existing) {
        existing.semanticScore = rrfScore;
        existing.finalScore = (existing.bm25Score || 0) + rrfScore;
      } else {
        resultMap.set(result.rid, { 
          ...result, 
          semanticScore: rrfScore, 
          finalScore: rrfScore 
        });
      }
    });
    
    return Array.from(resultMap.values())
      .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
  }
}
```

#### 4. Search API

```typescript
export class SearchAPI {
  constructor(
    private space: Space,
    private indexManager: SearchIndexManager
  ) {}
  
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    const results = await this.indexManager.search(query, options);
    
    return {
      query,
      results: results.slice(0, options.limit || 20),
      total: results.length,
      took: Date.now() - startTime
    };
  }
  
  async suggest(query: string): Promise<string[]> {
    // Implement query suggestions
    return this.indexManager.getSuggestions(query);
  }
  
  async getResource(rid: string): Promise<SearchResource | null> {
    return this.indexManager.getResource(rid);
  }
}
```

### Integration Points

#### 1. Space Integration

```typescript
// Add search capabilities to Space class
export class Space {
  private searchAPI: SearchAPI | null = null;
  
  getSearchAPI(): SearchAPI {
    if (!this.searchAPI) {
      const fileStore = this.getFileStore();
      if (!fileStore) {
        throw new Error("FileStore not available for search");
      }
      
      const indexManager = new SearchIndexManager(this, fileStore);
      this.searchAPI = new SearchAPI(this, indexManager);
    }
    
    return this.searchAPI;
  }
  
  async reindexWorkspace(): Promise<void> {
    const indexer = new ContentIndexer(this, this.getSearchAPI().indexManager);
    await indexer.indexWorkspace();
  }
}
```

#### 2. FileStore Integration

```typescript
// Extend FileStore for search indices
export interface FileStore {
  // Existing methods...
  
  // Search index methods
  putSearchIndex(indexId: string, data: Uint8Array): Promise<void>;
  getSearchIndex(indexId: string): Promise<Uint8Array>;
  existsSearchIndex(indexId: string): Promise<boolean>;
  deleteSearchIndex(indexId: string): Promise<void>;
}
```

### Search Configuration

```typescript
interface SearchConfig {
  // BM25 settings
  bm25: {
    k1: number;           // Term frequency normalization
    b: number;            // Length normalization
    minTermLength: number;
    stopWords: string[];
  };
  
  // Embedding settings
  embeddings: {
    model: string;        // Model name/ID
    dimensions: number;   // Vector dimensions
    normalize: boolean;   // Normalize vectors
  };
  
  // Search settings
  search: {
    maxResults: number;   // Maximum results per query
    hybridWeight: number; // Weight for hybrid combination
    mmrLambda: number;   // MMR diversification factor
  };
  
  // Indexing settings
  indexing: {
    chunkSize: number;   // Text chunk size
    chunkOverlap: number; // Overlap between chunks
    batchSize: number;   // Batch size for processing
  };
}
```

### Performance Optimizations

1. **Lazy Loading**: Load search indices only when needed
2. **Incremental Indexing**: Update indices incrementally as content changes
3. **Caching**: Cache frequently accessed embeddings and results
4. **Background Processing**: Perform heavy indexing operations in background
5. **Compression**: Compress stored vectors and indices

### Security Considerations

1. **Access Control**: Respect workspace visibility settings
2. **Data Privacy**: Keep all search data local to the workspace
3. **Encryption**: Encrypt sensitive search indices if needed
4. **Audit Trail**: Log search activities for debugging

## Implementation Plan

### Phase 1: Core Infrastructure
- [ ] Implement `SearchIndexManager` class
- [ ] Set up SQLite database for vector storage
- [ ] Implement basic BM25 indexing
- [ ] Create search API interface

### Phase 2: Content Indexing
- [ ] Implement `ContentIndexer` for different content types
- [ ] Add chat conversation indexing
- [ ] Add file content indexing
- [ ] Implement incremental indexing

### Phase 3: Hybrid Search
- [ ] Implement semantic search with embeddings
- [ ] Add hybrid result combination
- [ ] Implement MMR diversification
- [ ] Add field boosts and filters

### Phase 4: UI Integration
- [ ] Add search UI components
- [ ] Implement search suggestions
- [ ] Add result highlighting
- [ ] Create search settings interface

### Phase 5: Optimization
- [ ] Performance optimizations
- [ ] Background indexing
- [ ] Caching strategies
- [ ] Memory management

## Testing Strategy

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test search functionality with real workspace data
3. **Performance Tests**: Measure search latency and indexing speed
4. **Cross-Platform Tests**: Ensure compatibility across different environments

## Future Enhancements

1. **Advanced Reranking**: Implement cross-encoder reranking
2. **Multi-Language Support**: Support for multiple languages
3. **Federated Search**: Search across multiple workspaces
4. **AI-Powered Suggestions**: Use AI for query suggestions and result ranking
5. **Visual Search**: Support for image and document search

## Conclusion

This proposal provides a comprehensive approach to implementing search in Sila workspaces. The hybrid search system will provide users with powerful search capabilities while maintaining the privacy and performance characteristics that make Sila unique. The modular design allows for incremental implementation and future enhancements.

The integration with Sila's existing architecture ensures that search becomes a natural part of the workspace experience, enabling users to find and access their content efficiently across all supported platforms.