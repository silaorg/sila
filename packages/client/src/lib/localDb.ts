import Dexie from 'dexie';
import type { SpacePointer } from "./spaces/SpacePointer";
import type { VertexOperation } from "@sila/core";

/**
 * Space setup on a client side
 * The setup points to a space either local or remote by url field
 */
export type SpaceSetup = {
  // Global unique identifier of the space
  id: string;
  // The url to the space: both local and remote; e.g file://path/to/space-dir or http://example.com/space-api
  uri: string;
  name: string | null;
  createdAt: Date;
  userId: string | null; // null for spaces created before user authentication

  // Additional fields
  ttabsLayout?: string | null;
  theme?: string | null;
  colorScheme?: 'system' | 'light' | 'dark' | null;
  drafts?: { [draftId: string]: string } | null;
  // Note: secrets moved to separate table
};

export interface ConfigEntry {
  key: string;
  value: unknown;
}

// Interned space reference: store (spaceUri, spaceId) once and refer to it by numeric id
export interface SpaceRefRecord {
  spaceRefId?: number; // autoincremented primary key
  spaceUri: string;
  spaceId: string;
  // Space-scoped UI state (small blobs; 1 record per spaceRef)
  ttabsLayout?: string | null;
}

// Individual secret record - matches server schema
export interface SecretRecord {
  spaceRefId: number;
  key: string;
  value: string;
}

// Table for operations with split operation IDs
export interface TreeOperation {
  // Composite primary key components
  clock: number;        // The counter/clock value
  peerId: string;       // The peer ID
  treeId: string;       // Tree identifier
  spaceRefId: number;   // Interned (spaceUri, spaceId)

  // Operation data
  targetId: string;     // Target vertex ID

  // Move operation: has parentId
  parentId?: string;    // For move operations

  // Property operation: has key/value/transient  
  key?: string;         // Property key
  value?: any;          // Property value
}

class LocalDb extends Dexie {
  spaces!: Dexie.Table<SpaceSetup, string>;
  spaceRefs!: Dexie.Table<SpaceRefRecord, number>;
  config!: Dexie.Table<ConfigEntry, string>;
  treeOps!: Dexie.Table<TreeOperation, [number, string, string, number]>; // [clock, peerId, treeId, spaceRefId]
  secrets!: Dexie.Table<SecretRecord, [number, string]>; // [spaceRefId, key]

  constructor() {
    // WIP: we intentionally reset IndexedDB schema without migration.
    // Using a new DB name gives us a clean slate.
    super('localDb-v6');

    this.version(1).stores({
      // Keyed by uri (UI/reference key). id is stored as a value and may repeat across URIs.
      spaces: '&uri, id, name, createdAt, userId',
      // Intern mapping: (spaceUri, spaceId) -> spaceRefId (autoincrement)
      spaceRefs: '++spaceRefId,&[spaceUri+spaceId], spaceUri, spaceId',
      config: '&key',
      // Ops are keyed by interned spaceRefId to avoid repeating long URIs on every row.
      treeOps: '&[clock+peerId+treeId+spaceRefId], spaceRefId, treeId, [spaceRefId+treeId]',
      // Secrets are keyed by interned spaceRefId.
      secrets: '&[spaceRefId+key], spaceRefId'
    });
  }
}

export const db = new LocalDb();

const _spaceRefCache = new Map<string, number>();
function _spaceRefCacheKey(spaceUri: string, spaceId: string): string {
  // Stable cache key; not persisted.
  return `${spaceUri}\u0000${spaceId}`;
}

async function getSpaceRefId(spaceUri: string, spaceId: string): Promise<number | null> {
  const cacheKey = _spaceRefCacheKey(spaceUri, spaceId);
  const cached = _spaceRefCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const existing = await db.spaceRefs
    .where('[spaceUri+spaceId]')
    .equals([spaceUri, spaceId])
    .first();
  if (!existing?.spaceRefId) return null;

  _spaceRefCache.set(cacheKey, existing.spaceRefId);
  return existing.spaceRefId;
}

async function getOrCreateSpaceRefId(spaceUri: string, spaceId: string): Promise<number> {
  const existing = await getSpaceRefId(spaceUri, spaceId);
  if (existing !== null) return existing;

  const cacheKey = _spaceRefCacheKey(spaceUri, spaceId);
  const newId = await db.spaceRefs.add({ spaceUri, spaceId });
  _spaceRefCache.set(cacheKey, newId);
  return newId;
}

// Convert to VertexOperation for RepTree
function toVertexOperation(op: TreeOperation): VertexOperation {
  if (op.parentId !== undefined) {
    // Move operation detected by presence of parentId
    return {
      id: { counter: op.clock, peerId: op.peerId },
      targetId: op.targetId,
      parentId: op.parentId
    } as VertexOperation;
  } else {
    // Property operation detected by presence of key
    return {
      id: { counter: op.clock, peerId: op.peerId },
      targetId: op.targetId,
      key: op.key!,
      value: op.value,
    } as VertexOperation;
  }
}

// Convert from VertexOperation for storage
function fromVertexOperation(op: VertexOperation, spaceRefId: number, treeId: string): TreeOperation {
  const base: Partial<TreeOperation> = {
    clock: op.id.counter,
    peerId: op.id.peerId,
    treeId,
    spaceRefId,
    targetId: op.targetId
  };

  // Move operation
  if ('parentId' in op) {
    return { ...base, parentId: op.parentId } as TreeOperation;
  }
  // Property operation
  else {
    return {
      ...base,
      key: op.key,
      value: op.value,
    } as TreeOperation;
  }
}

export async function getAllPointers(): Promise<SpacePointer[]> {
  try {
    // Get all spaces but only return the pointer fields
    const spaces = await db.spaces.toArray();
    return spaces.map(space => ({
      id: space.id,
      uri: space.uri,
      name: space.name,
      createdAt: space.createdAt,
      userId: space.userId
    }));
  } catch (error) {
    console.error('Failed to get pointers from database:', error);
    return [];
  }
}

// Get spaces for a specific user ID (including local spaces with null userId)
export async function getPointersForUser(userId: string | null): Promise<SpacePointer[]> {
  try {
    const spaces = await db.spaces.toArray();

    // Filter spaces: always show local spaces (null userId) + user's spaces when authenticated
    const filteredSpaces = spaces.filter(space => {
      // Always show local spaces (null userId)
      if (space.userId === null) {
        return true;
      }

      // Show user's spaces only when authenticated and userId matches
      if (userId !== null && space.userId === userId) {
        return true;
      }

      return false;
    });

    return filteredSpaces.map(space => ({
      id: space.id,
      uri: space.uri,
      name: space.name,
      createdAt: space.createdAt,
      userId: space.userId
    }));
  } catch (error) {
    console.error('Failed to get pointers for user from database:', error);
    return [];
  }
}

export async function getCurrentSpaceId(): Promise<string | null> {
  try {
    const entry = await db.config.get('currentSpaceId');
    return entry ? entry.value as string : null;
  } catch (error) {
    console.error('Failed to get currentSpaceId from database:', error);
    return null;
  }
}

export async function getCurrentSpaceUri(): Promise<string | null> {
  try {
    const entry = await db.config.get('currentSpaceUri');
    return entry ? entry.value as string : null;
  } catch (error) {
    console.error('Failed to get currentSpaceUri from database:', error);
    return null;
  }
}

export async function getAllConfig(): Promise<Record<string, unknown>> {
  try {
    const entries = await db.config.toArray();
    return Object.fromEntries(entries.map(e => [e.key, e.value]));
  } catch (error) {
    console.error('Failed to get config from database:', error);
    return {};
  }
}

export async function savePointers(pointers: SpacePointer[]): Promise<void> {
  try {
    // Ensure all pointers have serializable createdAt dates
    const serializablePointers = pointers.map(pointer => {
      // Make a copy of the pointer to avoid modifying the original
      const serializedPointer = { ...pointer };

      // Ensure createdAt is a proper Date object
      // If it's already a Date, use it; otherwise try to create a new Date from it
      if (!(serializedPointer.createdAt instanceof Date)) {
        try {
          serializedPointer.createdAt = new Date(serializedPointer.createdAt);
        } catch (dateError) {
          console.error('Failed to convert createdAt to Date:', dateError);
          // Fallback to current date if conversion fails
          serializedPointer.createdAt = new Date();
        }
      }

      return serializedPointer;
    });

    // Convert pointers to SpaceSetup objects and save them
    // This preserves any existing additional data like ttabsLayout
    for (const pointer of serializablePointers) {
      try {
        // Check if this space already exists
        const existingSpace = await db.spaces.get(pointer.uri);

        if (existingSpace) {
          // Update only the pointer fields, preserving other data
          await db.spaces.update(pointer.uri, {
            uri: pointer.uri,
            id: pointer.id,
            name: pointer.name,
            createdAt: pointer.createdAt,
            userId: pointer.userId
          });
        } else {
          // Create a new space setup
          await db.spaces.put({
            ...pointer,
            ttabsLayout: null,
            theme: null,
            drafts: null,
          });
        }
      } catch (spaceError) {
        console.error(`Failed to save space ${pointer.uri}:`, spaceError);
      }
    }
  } catch (error) {
    console.error('Failed to save pointers to database:', error);
  }
}

export async function saveConfig(config: Record<string, unknown>): Promise<void> {
  try {
    await db.config.bulkPut(
      Object.entries(config).map(([key, value]) => ({ key, value }))
    );
  } catch (error) {
    console.error('Failed to save config to database:', error);
  }
}

export async function saveCurrentSpaceId(id: string | null): Promise<void> {
  if (id === null) return;

  try {
    await db.config.put({ key: 'currentSpaceId', value: id });
  } catch (error) {
    console.error('Failed to save currentSpaceId to database:', error);
  }
}

export async function saveCurrentSpaceUri(uri: string | null): Promise<void> {
  if (uri === null) return;

  try {
    await db.config.put({ key: 'currentSpaceUri', value: uri });
  } catch (error) {
    console.error('Failed to save currentSpaceUri to database:', error);
  }
}

export async function initializeDatabase(): Promise<{
  pointers: SpacePointer[];
  currentSpaceId: string | null;
  currentSpaceUri: string | null;
  config: Record<string, unknown>;
}> {
  try {
    const pointers = await getAllPointers();
    const currentSpaceId = await getCurrentSpaceId();
    const currentSpaceUri = await getCurrentSpaceUri();
    const config = await getAllConfig();

    return { pointers, currentSpaceId, currentSpaceUri, config };
  } catch (error) {
    console.error('Failed to initialize database:', error);

    // Attempt recovery
    try {
      await db.delete();
      await db.open();
      console.log('Database reset after error');
    } catch (recoveryError) {
      console.error('Failed to recover database:', recoveryError);
    }

    return { pointers: [], currentSpaceId: null, currentSpaceUri: null, config: {} };
  }
}

// Get the complete SpaceSetup for a space
export async function getSpaceSetup(spaceUri: string): Promise<SpaceSetup | undefined> {
  try {
    return await db.spaces.get(spaceUri);
  } catch (error) {
    console.error(`Failed to get setup for space ${spaceUri}:`, error);
    return undefined;
  }
}

// Get just the ttabsLayout for a space (keyed by space URI)
export async function getTtabsLayout(spaceUri: string): Promise<string | null | undefined> {
  try {
    const space = await db.spaces.get(spaceUri);
    if (!space) return null;

    const spaceRefId = await getSpaceRefId(spaceUri, space.id);
    if (spaceRefId === null) return null;

    const ref = await db.spaceRefs.get(spaceRefId);
    return ref?.ttabsLayout ?? null;
  } catch (error) {
    console.error(`Failed to get ttabsLayout for space ${spaceUri}:`, error);
    return undefined;
  }
}

// Save ttabsLayout for a space (keyed by space URI)
export async function saveTtabsLayout(spaceUri: string, layout: string): Promise<void> {
  try {
    const space = await db.spaces.get(spaceUri);
    if (!space) return;

    const spaceRefId = await getOrCreateSpaceRefId(spaceUri, space.id);
    await db.spaceRefs.update(spaceRefId, { ttabsLayout: layout });
  } catch (error) {
    console.error(`Failed to save ttabsLayout for space ${spaceUri}:`, error);
  }
}

// Get operations for a specific tree
export async function getTreeOps(spaceUri: string, spaceId: string, treeId: string): Promise<VertexOperation[]> {
  try {
    const spaceRefId = await getSpaceRefId(spaceUri, spaceId);
    if (spaceRefId === null) return [];

    const treeOps = await db.treeOps
      .where('[spaceRefId+treeId]')
      .equals([spaceRefId, treeId])
      .toArray();

    return treeOps.map(toVertexOperation);
  } catch (error) {
    console.error(`Failed to get ops for tree ${treeId} in space ${spaceUri} (${spaceId}):`, error);
    return [];
  }
}

export async function appendTreeOps(spaceUri: string, spaceId: string, treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
  if (ops.length === 0) return;

  const spaceRefId = await getOrCreateSpaceRefId(spaceUri, spaceId);
  const treeOpsEntries = ops.map(op => fromVertexOperation(op, spaceRefId, treeId));

  // Use bulkPut to store operations
  await db.treeOps.bulkPut(treeOpsEntries);
}

export async function getAllSpaceTreeOps(spaceUri: string, spaceId: string): Promise<Map<string, VertexOperation[]>> {
  try {
    const spaceRefId = await getSpaceRefId(spaceUri, spaceId);
    if (spaceRefId === null) return new Map();

    const treeOps = await db.treeOps
      .where('spaceRefId')
      .equals(spaceRefId)
      .toArray();

    const treeOpsMap = new Map<string, VertexOperation[]>();

    for (const entry of treeOps) {
      if (!treeOpsMap.has(entry.treeId)) {
        treeOpsMap.set(entry.treeId, []);
      }
      treeOpsMap.get(entry.treeId)!.push(toVertexOperation(entry));
    }

    return treeOpsMap;
  } catch (error) {
    console.error(`Failed to get all tree ops for space ${spaceUri} (${spaceId}):`, error);
    return new Map();
  }
}

export async function deleteTreeOps(spaceUri: string, spaceId: string, treeId: string): Promise<void> {
  try {
    const spaceRefId = await getSpaceRefId(spaceUri, spaceId);
    if (spaceRefId === null) return;

    await db.treeOps
      .where('[spaceRefId+treeId]')
      .equals([spaceRefId, treeId])
      .delete();
  } catch (error) {
    console.error(`Failed to delete ops for tree ${treeId} in space ${spaceUri} (${spaceId}):`, error);
  }
}

export async function getTreeOpCount(spaceUri: string, spaceId: string, treeId: string): Promise<number> {
  try {
    const spaceRefId = await getSpaceRefId(spaceUri, spaceId);
    if (spaceRefId === null) return 0;

    return await db.treeOps
      .where('[spaceRefId+treeId]')
      .equals([spaceRefId, treeId])
      .count();
  } catch (error) {
    console.error(`Failed to get op count for tree ${treeId} in space ${spaceUri} (${spaceId}):`, error);
    return 0;
  }
}

// Save theme for a space
export async function saveSpaceTheme(spaceUri: string, theme: string): Promise<void> {
  try {
    await db.spaces
      .where('uri')
      .equals(spaceUri)
      .modify({ theme: theme });
  } catch (error) {
    console.error(`Failed to save theme for space ${spaceUri}:`, error);
  }
}

// Save color scheme for a space
export async function saveSpaceColorScheme(spaceUri: string, colorScheme: 'system' | 'light' | 'dark'): Promise<void> {
  try {
    await db.spaces
      .where('uri')
      .equals(spaceUri)
      .modify({ colorScheme: colorScheme });
  } catch (error) {
    console.error(`Failed to save color scheme for space ${spaceUri}:`, error);
  }
}

// Delete a space from the database
export async function deleteSpace(spaceUri: string): Promise<void> {
  try {
    let spaceIdsToClearCache: string[] = [];
    await db.transaction('rw', [db.spaces, db.spaceRefs, db.treeOps, db.secrets, db.config], async () => {
      const refs = await db.spaceRefs.where('spaceUri').equals(spaceUri).toArray();
      spaceIdsToClearCache = refs.map(r => r.spaceId);
      const refIds = refs
        .map(r => r.spaceRefId)
        .filter((v): v is number => typeof v === "number");

      if (refIds.length > 0) {
        await db.treeOps.where('spaceRefId').anyOf(refIds).delete();
        await db.secrets.where('spaceRefId').anyOf(refIds).delete();
      }

      // Delete interned refs for this URI
      await db.spaceRefs.where('spaceUri').equals(spaceUri).delete();

      // Delete the space from the spaces table
      await db.spaces.delete(spaceUri);

      // Check if this was the current space and clear it if so
      const currentUri = await getCurrentSpaceUri();
      if (currentUri === spaceUri) {
        await db.config.delete('currentSpaceUri');
        // Clear legacy id-based selection too (it may point to this space id).
        await db.config.delete('currentSpaceId');
      }
    });

    // Clear in-memory cache entries for this URI (best-effort; not persisted)
    for (const spaceId of spaceIdsToClearCache) {
      _spaceRefCache.delete(_spaceRefCacheKey(spaceUri, spaceId));
    }

    console.log(`Space ${spaceUri} deleted from database`);
  } catch (error) {
    console.error(`Failed to delete space ${spaceUri} from database:`, error);
  }
}

// Get a draft for a space and draftId
export async function getDraft(spaceUri: string, draftId: string): Promise<string | undefined> {
  try {
    const space = await db.spaces.get(spaceUri);
    return space?.drafts?.[draftId];
  } catch (error) {
    console.error(`Failed to get draft for space ${spaceUri} and draftId ${draftId}:`, error);
    return undefined;
  }
}

// Save a draft for a space
export async function saveDraft(spaceUri: string, draftId: string, content: string): Promise<void> {
  try {
    await db.spaces
      .where('uri')
      .equals(spaceUri)
      .modify((space) => {
        if (!space.drafts) {
          space.drafts = {};
        }
        space.drafts[draftId] = content;
      });
  } catch (error) {
    console.error(`Failed to save draft for space ${spaceUri} and draftId ${draftId}:`, error);
  }
}

// Delete a draft for a space
export async function deleteDraft(spaceUri: string, draftId: string): Promise<void> {
  try {
    await db.spaces
      .where('uri')
      .equals(spaceUri)
      .modify((space) => {
        if (space.drafts && space.drafts[draftId]) {
          delete space.drafts[draftId];
        }
      });
  } catch (error) {
    console.error(`Failed to delete draft for space ${spaceUri} and draftId ${draftId}:`, error);
  }
}

// Get all secrets for a space
export async function getAllSecrets(spaceUri: string, spaceId: string): Promise<Record<string, string> | undefined> {
  try {
    const spaceRefId = await getSpaceRefId(spaceUri, spaceId);
    if (spaceRefId === null) return undefined;

    const secretRecords = await db.secrets
      .where('spaceRefId')
      .equals(spaceRefId)
      .toArray();

    if (secretRecords.length === 0) {
      return undefined;
    }

    const secrets: Record<string, string> = {};
    for (const record of secretRecords) {
      secrets[record.key] = record.value;
    }

    return secrets;
  } catch (error) {
    console.error(`Failed to get all secrets for space ${spaceUri} (${spaceId}):`, error);
    return undefined;
  }
}

// Save all secrets for a space
export async function saveAllSecrets(spaceUri: string, spaceId: string, secrets: Record<string, string>): Promise<void> {
  try {
    const spaceRefId = await getOrCreateSpaceRefId(spaceUri, spaceId);
    const secretRecords: SecretRecord[] = Object.entries(secrets).map(([key, value]) => ({
      spaceRefId,
      key,
      value,
    }));

    // Use bulkPut to insert/update all secrets
    await db.secrets.bulkPut(secretRecords);
  } catch (error) {
    console.error(`Failed to save all secrets for space ${spaceUri} (${spaceId}):`, error);
  }
}

// Get a specific secret for a space
export async function getSecret(spaceUri: string, spaceId: string, key: string): Promise<string | undefined> {
  try {
    const spaceRefId = await getSpaceRefId(spaceUri, spaceId);
    if (spaceRefId === null) return undefined;

    const secretRecord = await db.secrets
      .where('[spaceRefId+key]')
      .equals([spaceRefId, key])
      .first();

    return secretRecord?.value;
  } catch (error) {
    console.error(`Failed to get secret ${key} for space ${spaceUri} (${spaceId}):`, error);
    return undefined;
  }
}

// Set a specific secret for a space
export async function setSecret(spaceUri: string, spaceId: string, key: string, value: string): Promise<void> {
  try {
    const spaceRefId = await getOrCreateSpaceRefId(spaceUri, spaceId);
    await db.secrets.put({
      spaceRefId,
      key,
      value
    });
  } catch (error) {
    console.error(`Failed to set secret ${key} for space ${spaceUri} (${spaceId}):`, error);
  }
}

// Delete a specific secret for a space
export async function deleteSecret(spaceUri: string, spaceId: string, key: string): Promise<void> {
  try {
    const spaceRefId = await getSpaceRefId(spaceUri, spaceId);
    if (spaceRefId === null) return;

    await db.secrets
      .where('[spaceRefId+key]')
      .equals([spaceRefId, key])
      .delete();
  } catch (error) {
    console.error(`Failed to delete secret ${key} for space ${spaceUri} (${spaceId}):`, error);
  }
}

// Associate existing spaces (with null userId) to a user - this is now optional and manual
export async function associateSpacesWithUser(userId: string): Promise<void> {
  try {
    await db.spaces
      .filter(space => space.userId === null)
      .modify({ userId });
    console.log(`Associated existing local spaces with user ${userId}`);
  } catch (error) {
    console.error(`Failed to associate spaces with user ${userId}:`, error);
  }
}

// Associate a specific local space with the current user
export async function associateLocalSpaceWithUser(spaceId: string, userId: string): Promise<void> {
  try {
    const space = await db.spaces.get(spaceId);
    if (space && space.userId === null) {
      await db.spaces.update(spaceId, { userId });
      console.log(`Associated local space ${spaceId} with user ${userId}`);
    } else if (space && space.userId !== null) {
      throw new Error('Space is already associated with a user');
    } else {
      throw new Error('Space not found');
    }
  } catch (error) {
    console.error(`Failed to associate space ${spaceId} with user ${userId}:`, error);
    throw error;
  }
}

// Convert a user space back to local space
export async function makeSpaceLocal(spaceId: string): Promise<void> {
  try {
    await db.spaces.update(spaceId, { userId: null });
    console.log(`Made space ${spaceId} local`);
  } catch (error) {
    console.error(`Failed to make space ${spaceId} local:`, error);
    throw error;
  }
}

// Update the userId for a specific space
export async function updateSpaceUserId(spaceId: string, userId: string | null): Promise<void> {
  try {
    await db.spaces
      .where('id')
      .equals(spaceId)
      .modify({ userId });
  } catch (error) {
    console.error(`Failed to update userId for space ${spaceId}:`, error);
  }
}


