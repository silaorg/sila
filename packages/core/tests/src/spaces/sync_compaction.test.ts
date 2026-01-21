import { describe, it, expect, vi } from 'vitest';
import { SpaceManager } from '../../../src/spaces/SpaceManager';
import { ConnectedPersistenceLayer } from '../../../src/spaces/persistence/PersistenceLayer';
import type { VertexOperation } from 'reptree';
import { isAnyPropertyOp } from 'reptree'; // Assuming this is available or I'll reimplement check

// Mock implementation of PersistenceLayer
class MockPersistenceLayer extends ConnectedPersistenceLayer {
  ops: VertexOperation[] = [];
  savedOps: VertexOperation[] = []; // To track what was saved

  constructor(public id: string, public type: 'local' | 'remote') {
    super();
  }

  protected async doConnect(): Promise<void> {}
  protected async doDisconnect(): Promise<void> {}

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    return [...this.ops];
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    this.savedOps.push(...ops);
    this.ops.push(...ops);
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    return [...this.ops];
  }

  async loadSecrets(): Promise<Record<string, string> | undefined> {
    return {};
  }

  async saveSecrets(secrets: Record<string, string>): Promise<void> {}
}

describe('SpaceManager Sync Compaction', () => {
  it('should not sync old property ops back to a layer that has compacted them', async () => {
    const spaceManager = new SpaceManager();
    const treeId = 'tree-1';

    // Op 1: set key 'a' to 1
    const op1: VertexOperation = {
      id: { counter: 1, peerId: 'peer1' },
      targetId: 'root',
      key: 'a',
      value: 1
    };

    // Op 2: set key 'a' to 2 (newer)
    const op2: VertexOperation = {
      id: { counter: 2, peerId: 'peer1' },
      targetId: 'root',
      key: 'a',
      value: 2
    };

    // Op 3: set key 'b' to 1 (unrelated)
    const op3: VertexOperation = {
      id: { counter: 3, peerId: 'peer1' },
      targetId: 'root',
      key: 'b',
      value: 1
    };

    // File System Layer (Compacted): Has only op2 (latest 'a') and op3
    const fsLayer = new MockPersistenceLayer('fs-layer', 'local');
    fsLayer.ops = [op2, op3];

    // IndexedDB Layer (Full History): Has op1, op2, and op3
    const idbLayer = new MockPersistenceLayer('idb-layer', 'local');
    idbLayer.ops = [op1, op2, op3];

    const layers = [fsLayer, idbLayer];

    // Run sync
    await spaceManager.syncTreeOpsBetweenLayers(treeId, layers);

    // fsLayer should NOT have received op1 because it already has op2 which is newer
    const op1SavedToFs = fsLayer.savedOps.find(op => op.id.counter === 1 && op.key === 'a');
    expect(op1SavedToFs).toBeUndefined();
  });

  it('should handle concurrent ops correctly (tie-breaking with peerId)', async () => {
    const spaceManager = new SpaceManager();
    const treeId = 'tree-concurrent';

    // Peer 'B' > Peer 'A' lexicographically. So opB wins over opA if counters are equal.

    // Op A: counter 10, peer 'A', key 'x'
    const opA: VertexOperation = {
      id: { counter: 10, peerId: 'A' },
      targetId: 'root',
      key: 'x',
      value: 'valA'
    };

    // Op B: counter 10, peer 'B', key 'x'
    const opB: VertexOperation = {
      id: { counter: 10, peerId: 'B' },
      targetId: 'root',
      key: 'x',
      value: 'valB'
    };

    // Case 1: Layer has Winner (opB), Incoming is Loser (opA). Should reject opA.
    const layerHasWinner = new MockPersistenceLayer('layer-winner', 'local');
    layerHasWinner.ops = [opB];

    const layerHasLoser = new MockPersistenceLayer('layer-loser', 'local');
    layerHasLoser.ops = [opA]; // It only has A

    // Sync between them.
    // layerHasWinner has B. layerHasLoser has A.
    // layerHasWinner should check missing A. It has B. B > A. So it should SKIP A.
    // layerHasLoser should check missing B. It has A. A < B. So it should ACCEPT B.

    await spaceManager.syncTreeOpsBetweenLayers(treeId, [layerHasWinner, layerHasLoser]);

    // Check layerHasWinner: should NOT have saved A.
    const savedA = layerHasWinner.savedOps.find(op => op.id.peerId === 'A');
    expect(savedA).toBeUndefined();

    // Check layerHasLoser: SHOULD have saved B.
    const savedB = layerHasLoser.savedOps.find(op => op.id.peerId === 'B');
    expect(savedB).toBeDefined();
    expect(savedB).toEqual(opB);
  });
});
