# Proposal: Treat Root Space Tree as App Tree

**Status**: Draft  
**Created**: 2026-02-06  
**Updated**: 2026-02-06

## Summary

Unify the loading mechanism for root space trees and app trees by treating the root tree as just another app tree. This simplifies the `SyncLayer` interface and `SpaceRunner2` implementation by using a single code path for all tree loading.

## Problem

Currently, root space trees and app trees are loaded through different mechanisms:

- **Root trees**: Use dedicated `SyncLayer.loadSpaceTreeOps()` method
- **App trees**: Use generic `SyncLayer.loadTreeOps(treeId)` method

This creates code duplication and complexity:
- Two different loading paths in `SpaceRunner2`
- Two separate methods in the `SyncLayer` interface
- Inconsistent loading strategies (sequential for root, parallel racing for apps)

The root tree already has an ID (`space.id === space.tree.rootId`), so there's no fundamental reason it can't be loaded using the same generic method.

## Current Architecture

### SyncLayer Interface

```typescript
interface SyncLayer {
  loadSpaceTreeOps(): Promise<VertexOperation[]>     // Dedicated method for root
  loadTreeOps(treeId: string): Promise<VertexOperation[]>  // Generic method for apps
  saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void>
}
```

### SpaceRunner2 Loading

```typescript
// Root tree loading
async createOrUpdateSpace(layers: SyncLayer[]) {
  const ops = await layer.loadSpaceTreeOps();  // Special method
  const space = Space.existingSpaceFromOps(ops);
}

// App tree loading
async loadAppTree(treeId: string) {
  const ops = await layer.loadTreeOps(treeId);  // Generic method
  const tree = new RepTree(uuid(), ops);
  return new AppTree(tree);
}
```

## Proposed Solution

### Phase 1: Add Space ID Discovery

The key limitation is that the **URI doesn't contain the space ID**. We need to discover the space ID before we can load the root tree using `loadTreeOps(spaceId)`.

**Add `getSpaceId()` to SyncLayer interface:**

```typescript
interface SyncLayer {
  /** Get the space ID from this layer's storage */
  getSpaceId(): Promise<string | undefined>
  
  /** Load ops for any tree (including root tree) */
  loadTreeOps(treeId: string): Promise<VertexOperation[]>
  
  /** Save ops for any tree */
  saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void>
  
  // Remove: loadSpaceTreeOps()
}
```

### Phase 2: Discover Space ID in SpaceRunner2

When constructing `SpaceRunner2`, discover the space ID from the first available layer:

```typescript
class SpaceRunner2 {
  private spaceId: string | null = null;

  async startSync() {
    // Step 1: Discover the space ID from layers
    if (!this.spaceId) {
      this.spaceId = await this.discoverSpaceId();
    }
    
    // Step 2: Load root tree using the discovered space ID
    if (this.spaceId) {
      await this.loadRootTree(this.spaceId);
    } else {
      // No space exists yet, create a new one
      await this.createNewSpace();
    }
  }
  
  private async discoverSpaceId(): Promise<string | null> {
    // Race all layers to get first available space ID
    const results = await Promise.allSettled(
      this.layers.map(layer => layer.getSpaceId())
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }
    
    return null;
  }
  
  private async loadRootTree(spaceId: string) {
    // Use the same loading mechanism as app trees
    const rootTree = await this.loadTree(spaceId);
    if (rootTree) {
      this.space = new Space(rootTree.tree);
      this.setupTreeLoader();
      this.trackOps(this.layers);
    }
  }
}
```

### Phase 3: Unified Tree Loading

Rename `loadAppTree()` to `loadTree()` and use it for both root and app trees:

```typescript
class SpaceRunner2 {
  private async loadTree(treeId: string): Promise<AppTree | undefined> {
    // Same implementation as current loadAppTree()
    // Works for both root tree and app trees
    return new Promise<AppTree | undefined>((resolve) => {
      const accumulatedOps: VertexOperation[] = [];
      let tree: AppTree | undefined;
      let isResolved = false;

      const tryCreateTree = () => {
        try {
          const repTree = new RepTree(this.space!.tree.peerId, accumulatedOps);
          tree = new AppTree(repTree);
          isResolved = true;
          resolve(tree);
        } catch {
          // Not enough ops yet
        }
      };

      const loadLayer = async (layer: SyncLayer) => {
        try {
          const ops = await layer.loadTreeOps(treeId);
          if (ops.length === 0) return;

          accumulatedOps.push(...ops);

          if (tree) {
            tree.tree.merge(ops);
          } else {
            tryCreateTree();
          }
        } catch (e) {
          console.error(`Failed to load tree from layer ${layer.id}`, e);
        }
      };

      const allLayersPromise = Promise.allSettled(this.layers.map(loadLayer));

      allLayersPromise.then(() => {
        if (!isResolved) resolve(undefined);
      });
    });
  }
}
```

## Implementation Details

### FileSystemSyncLayer Changes

```typescript
class FileSystemSyncLayer implements SyncLayer {
  private cachedSpaceId: string | undefined;
  
  async getSpaceId(): Promise<string | undefined> {
    if (this.cachedSpaceId) return this.cachedSpaceId;
    
    // Use the same logic this layer already has for finding space ops
    const opsPath = path.join(this.spacePath, 'space.ops.json');
    if (fs.existsSync(opsPath)) {
      const ops = JSON.parse(fs.readFileSync(opsPath, 'utf-8'));
      if (ops.length > 0) {
        // The first op creates the root vertex, its ID is the space ID
        this.cachedSpaceId = ops[0].vertexId;
        return this.cachedSpaceId;
      }
    }
    
    return undefined;
  }
  
  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    const spaceId = await this.getSpaceId();
    
    // Handle root tree
    if (treeId === spaceId) {
      const opsPath = path.join(this.spacePath, 'space.ops.json');
      // ... read root tree ops
      return JSON.parse(fs.readFileSync(opsPath, 'utf-8'));
    }
    
    // Handle app trees
    const opsPath = path.join(this.spacePath, 'trees', `${treeId}.ops.json`);
    // ... read app tree ops
    return JSON.parse(fs.readFileSync(opsPath, 'utf-8'));
  }
  
  // Remove: loadSpaceTreeOps() - no longer needed
}
```

**Key insight**: Each layer already knows how to find its space data (it does this in `loadSpaceTreeOps()`). The `getSpaceId()` method simply reuses that same logic to extract just the ID without loading all the ops.

## Migration Strategy

### Phase 1: Add getSpaceId() (Non-breaking)
1. Add `getSpaceId()` method to `SyncLayer` interface as optional
2. Implement in `FileSystemSyncLayer` and other layers using their existing logic for finding space data
3. Keep `loadSpaceTreeOps()` working as-is

### Phase 2: Update SpaceRunner2 (Non-breaking)
1. Add space ID discovery logic using `getSpaceId()`
2. Make `loadTree()` work for both root and app trees
3. Keep old code paths working

### Phase 3: Switch to New Path (Breaking but tested)
1. Update `SpaceRunner2.startSync()` to use new path
2. Remove old `createOrUpdateSpace()` logic
3. Test thoroughly

### Phase 4: Clean Up Interface (Breaking)
1. Make `getSpaceId()` required in `SyncLayer`
2. Remove `loadSpaceTreeOps()` from interface
3. Update all layer implementations
4. Generate migration guide

## Benefits

1. **Simplified Interface**: Single loading method (`loadTreeOps`) instead of two
2. **Code Reuse**: One loading path for all trees eliminates duplication
3. **Consistency**: Root and app trees treated uniformly
4. **Better Abstraction**: `SyncLayer` becomes more generic
5. **Clearer Semantics**: Space ID is explicitly discoverable, not implicit in the method name

## Challenges & Solutions

### Challenge 1: URI Doesn't Contain Space ID
**Solution**: Add `getSpaceId()` to discover the ID from layer storage before loading

### Challenge 2: Creating New Spaces
**Solution**: When `getSpaceId()` returns `null` from all layers, we know it's a new space. Generate a new ID and save metadata.

### Challenge 3: Loading Strategy Differences
**Current**: Root loads local→remote sequentially, apps race in parallel  
**Solution**: Maintain the same parallel racing strategy for both. The sequential local→remote was an optimization that may not be necessary.

**Alternative**: Add a strategy parameter:
```typescript
loadTree(treeId: string, strategy: 'sequential' | 'parallel' = 'parallel')
```

### Challenge 4: Backward Compatibility
**Solution**: No special handling needed - layers already know how to find their space data from `loadSpaceTreeOps()`. The `getSpaceId()` implementation reuses this existing logic.

## Open Questions

1. Should we optimize root tree loading differently (sequential local→remote) or use the same parallel strategy as app trees?
2. Should we add any caching for space IDs, or is it fast enough to derive from ops on each call?

## Success Criteria

- [ ] `SyncLayer` interface has single `loadTreeOps(treeId)` method
- [ ] `SpaceRunner2` uses same code path for root and app trees
- [ ] Space ID is discoverable via `getSpaceId()`
- [ ] All existing tests pass
- [ ] Performance is equal or better than current implementation
- [ ] Clear migration path for existing spaces

## Next Steps

1. ✅ Get feedback on approach (APPROVED)
2. Prototype `getSpaceId()` in `FileSystemSyncLayer`
3. Implement space ID discovery in `SpaceRunner2`
4. Update `SpaceRunner2.startSync()` to use unified loading
5. Test with existing spaces
6. Create migration guide
7. Update all layer implementations

## References

- [SpaceRunner2.ts](file:///Users/dk/repos/sila/packages/core/src/spaces/SpaceRunner2.ts)
- [Space.ts](file:///Users/dk/repos/sila/packages/core/src/spaces/Space.ts)
- [SyncLayer.ts](file:///Users/dk/repos/sila/packages/core/src/spaces/sync/SyncLayer.ts)
- [SpaceManager2.ts](file:///Users/dk/repos/sila/packages/core/src/spaces/SpaceManager2.ts)
