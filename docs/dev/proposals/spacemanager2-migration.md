# Migration Proposal: SpaceManager → SpaceManager2

**Status**: Draft  
**Author**: Deepmind Team  
**Date**: 2026-02-05

> **Note**: This proposal outlines the general approach for migrating to SpaceManager2. The actual implementation may differ as we discover new requirements or better approaches during development. Consider this a flexible guide rather than a strict specification.

## Executive Summary

Migrate from the current `SpaceManager` (using `PersistenceLayer`) to the new `SpaceManager2` (using `SyncLayer`) to simplify the architecture, improve performance, and enable better multi-device synchronization.

**Key Benefits**:
- ✅ Simpler API - no explicit connect/disconnect lifecycle
- ✅ Cleaner interface - layers auto-initialize on first use
- ✅ Better separation - `FileSystemSyncLayer` vs `FileSystemPersistenceLayer`
- ✅ Performance - initialization happens during load, not upfront
- ✅ Tested - comprehensive test suite with 8 passing tests

---

## Current System Architecture

### SpaceManager (Old)

```typescript
// Current initialization pattern
const spaceManager = new SpaceManager({
  hostType: 'desktop',
  resolvePersistenceLayers: (pointer, hostType) => {
    return createPersistenceLayersForURI(
      pointer.id,
      pointer.uri,
      fs,
      () => auth.getAccessToken()
    );
  }
});

// Loading a space
const space = await spaceManager.loadSpace(pointer, layers);

// PersistenceLayer interface (complex)
interface PersistenceLayer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  loadSpaceTreeOps(): Promise<VertexOperation[]>;
  loadTreeOps(treeId: string): Promise<VertexOperation[]>;
  saveTreeOps(treeId: string, ops: VertexOperation[]): Promise<void>;
  // ... many more optional methods
}
```

**Problems**:
- Explicit `connect()`/`disconnect()` lifecycle is error-prone
- Layers must be created upfront before usage
- Complex initialization ceremony
- `PersistenceLayer` interface is overloaded with optional methods

### SpaceManager2 (New)

```typescript
// New initialization pattern
const spaceManager2 = new SpaceManager2({
  setupSyncLayers: () => {
    return [
      new FileSystemSyncLayer(spacePath, spaceId, fs)
    ];
  }
});

// Loading a space
const space = await spaceManager2.loadSpace(uri);

// SyncLayer interface (simplified)
interface SyncLayer {
  readonly id: string;
  readonly type: 'local' | 'remote';
  loadSpaceTreeOps(): Promise<VertexOperation[]>;
  loadTreeOps(treeId: string): Promise<VertexOperation[]>;
  saveTreeOps(treeId: string, ops: VertexOperation[]): Promise<void>;
  dispose?(): Promise<void>; // Optional cleanup
}
```

**Improvements**:
- No explicit connect/disconnect - layers auto-initialize
- Setup callback creates layers on-demand
- Simpler interface with clear responsibilities
- URI-based space loading (more natural)

---

## API Comparison

| Feature | SpaceManager (Old) | SpaceManager2 (New) |
|---------|-------------------|-------------------|
| **Initialization** | `resolvePersistenceLayers` callback | `setupSyncLayers` callback |
| **Layer type** | `PersistenceLayer` | `SyncLayer` |
| **Layer lifecycle** | Explicit `connect()`/`disconnect()` | Auto-initialize, optional `dispose()` |
| **Load space** | `loadSpace(pointer, layers)` | `loadSpace(uri)` |
| **Add space** | `addNewSpace(space, layers, key)` | `addSpace(space, uri)` |
| **Space key** | Pointer or custom key | Always URI |
| **Runner** | `SpaceRunner` | `SpaceRunner2` |

---

## Affected Code Areas

### 1. Client (`packages/client/src/lib/state/clientState.svelte.ts`)

**Current Usage**:
```typescript
private createSpaceManager(): SpaceManager {
  const hostType = this.getHostType();
  return new SpaceManager({
    hostType,
    resolvePersistenceLayers: (pointer, resolvedHostType) =>
      this.resolvePersistenceLayers(pointer, resolvedHostType ?? hostType),
  });
}

private resolvePersistenceLayers(
  pointer: SpacePointer,
  hostType: SpaceRunnerHostType,
): PersistenceLayer[] {
  // ... creates FileSystemPersistenceLayer, RemotePersistenceLayer, etc.
  return createPersistenceLayersForURI(
    pointer.id,
    pointer.uri,
    this._fs,
    () => this.auth.getAccessToken(),
  );
}
```

**Migration**:
```typescript
private createSpaceManager(): SpaceManager2 {
  return new SpaceManager2({
    setupSyncLayers: () => this.createSyncLayers(),
  });
}

private createSyncLayers(): SyncLayer[] {
  const layers: SyncLayer[] = [];
  
  // Local file system layer
  if (this.currentSpaceUri && this._fs) {
    const spacePath = extractPathFromURI(this.currentSpaceUri);
    layers.push(new FileSystemSyncLayer(spacePath, spaceId, this._fs));
  }
  
  // Remote layer (if authenticated)
  if (this.auth.isAuthenticated) {
    layers.push(new RemoteSyncLayer(
      this.currentSpaceUri,
      () => this.auth.getAccessToken()
    ));
  }
  
  return layers;
}
```

**Key Changes**:
- Replace `resolvePersistenceLayers` with `setupSyncLayers`
- Create `FileSystemSyncLayer` instead of `FileSystemPersistenceLayer`
- No more `connect()` calls - layers auto-initialize
- Simpler layer creation logic

### 2. Server (`packages/server/src/db.ts`)

**Current Usage**:
```typescript
const spaceManager = new SpaceManager({ hostType: "server" });
const spaceLayers = new Map<string, FileSystemPersistenceLayer>();

export async function getServerSpaceLayer(spaceId: string) {
  let layer = spaceLayers.get(spaceId);
  if (!layer) {
    layer = new FileSystemPersistenceLayer(getSpacePath(spaceId), spaceId, serverFs);
    await layer.connect();
    spaceLayers.set(spaceId, layer);
    return layer;
  }
  
  if (!layer.isConnected()) {
    await layer.connect();
  }
  
  return layer;
}
```

**Migration**:
```typescript
const spaceManager = new SpaceManager2({
  setupSyncLayers: () => {
    // Layers will be created on-demand per space
    return [];
  }
});

// Simplified - no more manual layer management
export function getServerSpacePath(spaceId: string): string {
  return path.join(getDataDir(), "spaces", spaceId);
}

export async function getOrLoadServerSpace(spaceId: string): Promise<Space> {
  const spaceUri = `file://${getServerSpacePath(spaceId)}`;
  return await spaceManager.loadSpace(spaceUri);
}

export async function createServerSpace(input: { name: string; createdAt: string }): Promise<Space> {
  const space = Space.newSpace(uuid());
  space.name = input.name;
  
  const spaceUri = `file://${getServerSpacePath(space.id)}`;
  spaceManager.addSpace(space, spaceUri);
  
  return created;
}
```

**Key Changes**:
- Remove manual layer management and caching
- No more `connect()`/`isConnected()` checks
- Simpler API - just URIs
- `SpaceManager2` handles layer lifecycle internally

### 3. Tests

**Currently**: ~40 test files use `new SpaceManager({ disableBackend: true })`

**Migration Strategy**:
```typescript
// Before
const manager = new SpaceManager({ disableBackend: true });

// After - use TestInMemorySyncLayer or FileSystemSyncLayer
const manager = new SpaceManager2({
  setupSyncLayers: () => [new TestInMemorySyncLayer(space)]
});
```

---

## Migration Strategy

### Phase 1: Preparation
- [x] ✅ Implement `FileSystemSyncLayer`
- [x] ✅ Implement `SpaceManager2` and `SpaceRunner2`
- [x] ✅ Write comprehensive tests
- [ ] Create `RemoteSyncLayer` (HTTP-based sync)
- [ ] Create adapter utilities for gradual migration

### Phase 2: Parallel Systems
- [ ] Run both systems side-by-side
- [ ] Implement `SpaceManager2Adapter` for backward compatibility
- [ ] Update server to use `SpaceManager2` (simpler use case)
- [ ] Validate server functionality with real workloads

### Phase 3: Client Migration
- [ ] Update `ClientState` to use `SpaceManager2`
- [ ] Migrate `createPersistenceLayersForURI` → `createSyncLayersForURI`
- [ ] Update all client code referencing `SpaceManager`
- [ ] Test on all platforms (desktop, mobile, web)

### Phase 4: Test Migration
- [ ] Update all test files to use `SpaceManager2`
- [ ] Remove `SpaceManager` references
- [ ] Ensure all tests pass

### Phase 5: Cleanup
- [ ] Remove `SpaceManager`, `SpaceRunner`, `PersistenceLayer`
- [ ] Rename `SpaceManager2` → `SpaceManager`
- [ ] Update documentation
- [ ] Celebrate! 🎉

---

## Implementation Checklist

### Core Implementation
- [x] `SyncLayer` interface
- [x] `FileSystemSyncLayer`
- [x] `SpaceRunner2`
- [x] `SpaceManager2`
- [x] Test suite (8 tests passing)
- [ ] `RemoteSyncLayer` (for server sync)
- [ ] `IndexedDBSyncLayer` (for web)
- [ ] Migration utilities

### Client Updates
- [ ] Update `clientState.svelte.ts`
- [ ] Create `createSyncLayersForURI`
- [ ] Update `SpaceState` to work with `SpaceManager2`
- [ ] Test on desktop
- [ ] Test on mobile
- [ ] Test on web

### Server Updates
- [ ] Update `db.ts`
- [ ] Simplify layer management
- [ ] Update API endpoints using `SpaceManager`
- [ ] Test server functionality

### Test Updates
- [ ] Migrate `spacemanager.test.ts` ✅
- [ ] Migrate `spaces-*.test.ts` files
- [ ] Migrate `files-*.test.ts` files
- [ ] Migrate `chat-*.test.ts` files
- [ ] Migrate `ai-*.test.ts` files

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes in production | High | Run both systems in parallel, gradual rollout |
| Data migration issues | High | Extensive testing, backward compatibility |
| Performance regression | Medium | Benchmark before/after, optimize if needed |
| Missing features | Medium | Feature parity checklist, block migration if gaps |
| Test coverage gaps | Low | New test suite comprehensive, add more as needed |

---

## Success Criteria

- ✅ All existing functionality works with `SpaceManager2`
- ✅ No data loss during migration
- ✅ Performance equal or better than old system
- ✅ All tests passing
- ✅ Cleaner, more maintainable codebase
- ✅ Successful deployment on all platforms

---

## Next Steps

1. **Review this proposal** - Team review and feedback
2. **Create `RemoteSyncLayer`** - Implement HTTP-based sync
3. **Server migration** - Start with simpler server use case
4. **Client migration** - Update client code gradually
5. **Test migration** - Update all test files
6. **Cleanup** - Remove old code and celebrate!

---

## Open Questions

1. **RemoteSyncLayer**: Should we implement WebSocket-based sync or stick with HTTP polling?
2. **IndexedDB**: Do we need `IndexedDBSyncLayer` for web, or is `localStorage` sufficient?
3. **Backward compatibility**: How long should we maintain the old `SpaceManager`?
4. **Rollout strategy**: Big bang or gradual feature flag rollout?

---

## References

- [Implementation Plan](file:///Users/dk/.gemini/antigravity/brain/7d3a05e5-8b26-40f1-ad46-47ca3506bb9f/implementation_plan.md)
- [Walkthrough](file:///Users/dk/.gemini/antigravity/brain/7d3a05e5-8b26-40f1-ad46-47ca3506bb9f/walkthrough.md)
- [Test Proposal](file:///Users/dk/.gemini/antigravity/brain/7d3a05e5-8b26- 40f1-ad46-47ca3506bb9f/test_proposal.md)
- [SpaceRunner2.ts](file:///Users/dk/repos/sila/packages/core/src/spaces/SpaceRunner2.ts)
- [FileSystemSyncLayer.ts](file:///Users/dk/repos/sila/packages/core/src/spaces/sync/FileSystemSyncLayer.ts)
