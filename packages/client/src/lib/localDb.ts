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

// Individual secret record - matches server schema
export interface SecretRecord {
  spaceUri: string;
  spaceId: string;
  key: string;
  value: string;
}

// Table for operations with split operation IDs
export interface TreeOperation {
  // Composite primary key components
  clock: number;        // The counter/clock value
  peerId: string;       // The peer ID
  treeId: string;       // Tree identifier
  spaceUri: string;     // For easy bulk-delete by URI
  spaceId: string;      // Underlying space id (tree id)

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
  config!: Dexie.Table<ConfigEntry, string>;
  treeOps!: Dexie.Table<TreeOperation, [number, string, string, string, string]>; // [clock, peerId, treeId, spaceUri, spaceId]
  secrets!: Dexie.Table<SecretRecord, [string, string, string]>; // [spaceUri, spaceId, key]

  constructor() {
    // WIP: we intentionally reset IndexedDB schema without migration.
    // Using a new DB name gives us a clean slate.
    super('localDb-v4');

    this.version(1).stores({
      // Keyed by uri (UI/reference key). id is stored as a value and may repeat across URIs.
      spaces: '&uri, id, name, createdAt, userId',
      config: '&key',
      // Ops are keyed by (spaceUri + spaceId) to avoid collisions.
      treeOps: '&[clock+peerId+treeId+spaceUri+spaceId], spaceUri, spaceId, treeId, [spaceUri+spaceId], [spaceUri+spaceId+treeId]',
      // Secrets are keyed by (spaceUri + spaceId) so different spaces with same id don't collide.
      secrets: '&[spaceUri+spaceId+key], spaceUri, spaceId, [spaceUri+spaceId]'
    });
  }
}

export const db = new LocalDb();

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
function fromVertexOperation(op: VertexOperation, spaceUri: string, spaceId: string, treeId: string): TreeOperation {
  const base: Partial<TreeOperation> = {
    clock: op.id.counter,
    peerId: op.id.peerId,
    treeId,
    spaceUri,
    spaceId,
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

// Get just the ttabsLayout for a space
export async function getTtabsLayout(spaceKey: string): Promise<string | null | undefined> {
  try {
    // New: persist layout by "spaceKey" (typically pointer.uri) to support multiple pointers
    // that share the same underlying space id.
    const configKey = `ttabsLayout:${spaceKey}`;
    const fromConfig = await db.config.get(configKey);
    if (fromConfig?.value && typeof fromConfig.value === "string") {
      return fromConfig.value;
    }

    // Back-compat fallback (older versions stored layout inside spaces table by id).
    // 1) Try treat "spaceKey" as an id
    // For v3 DB, legacy layout can only be found by uri.
    const byUri = await db.spaces.where('uri').equals(spaceKey).first();
    return byUri?.ttabsLayout;
  } catch (error) {
    console.error(`Failed to get ttabsLayout for space ${spaceKey}:`, error);
    return undefined;
  }
}

// Save ttabsLayout for a space
export async function saveTtabsLayout(spaceKey: string, layout: string): Promise<void> {
  try {
    // New: store layout keyed by spaceKey (typically pointer.uri)
    await db.config.put({ key: `ttabsLayout:${spaceKey}`, value: layout });

    // Best-effort back-compat write for older app versions that expect layout on the space row.
    // Only do this when spaceKey looks like an actual space id record.
    // For v3 DB, no legacy writeback needed.
  } catch (error) {
    console.error(`Failed to save ttabsLayout for space ${spaceKey}:`, error);
  }
}

// Get operations for a specific tree
export async function getTreeOps(spaceUri: string, spaceId: string, treeId: string): Promise<VertexOperation[]> {
  try {
    const treeOps = await db.treeOps
      .where('[spaceUri+spaceId+treeId]')
      .equals([spaceUri, spaceId, treeId])
      .toArray();

    return treeOps.map(toVertexOperation);
  } catch (error) {
    console.error(`Failed to get ops for tree ${treeId} in space ${spaceUri} (${spaceId}):`, error);
    return [];
  }
}

export async function appendTreeOps(spaceUri: string, spaceId: string, treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
  if (ops.length === 0) return;

  const treeOpsEntries = ops.map(op => fromVertexOperation(op, spaceUri, spaceId, treeId));

  // Use bulkPut to store operations
  await db.treeOps.bulkPut(treeOpsEntries);
}

export async function getAllSpaceTreeOps(spaceUri: string, spaceId: string): Promise<Map<string, VertexOperation[]>> {
  try {
    const treeOps = await db.treeOps
      .where('[spaceUri+spaceId]')
      .equals([spaceUri, spaceId])
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
    await db.treeOps
      .where('[spaceUri+spaceId+treeId]')
      .equals([spaceUri, spaceId, treeId])
      .delete();
  } catch (error) {
    console.error(`Failed to delete ops for tree ${treeId} in space ${spaceUri} (${spaceId}):`, error);
  }
}

export async function getTreeOpCount(spaceUri: string, spaceId: string, treeId: string): Promise<number> {
  try {
    return await db.treeOps
      .where('[spaceUri+spaceId+treeId]')
      .equals([spaceUri, spaceId, treeId])
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
    await db.transaction('rw', [db.spaces, db.treeOps, db.secrets, db.config], async () => {
      // Delete all operations for this space
      await db.treeOps
        .where('spaceUri')
        .equals(spaceUri)
        .delete();

      // Delete all secrets for this space
      await db.secrets
        .where('spaceUri')
        .equals(spaceUri)
        .delete();

      // Delete the space from the spaces table
      await db.spaces.delete(spaceUri);

      // Check if this was the current space and clear it if so
      const currentId = await getCurrentSpaceId();
      if (currentId) await db.config.delete('currentSpaceId');

      const currentUri = await getCurrentSpaceUri();
      if (currentUri === spaceUri) {
        await db.config.delete('currentSpaceUri');
      }

      // Clean up any URI-keyed ttabs layout persisted in config
      await db.config.delete(`ttabsLayout:${spaceUri}`);
    });

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
    const secretRecords = await db.secrets
      .where('[spaceUri+spaceId]')
      .equals([spaceUri, spaceId])
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
    const secretRecords: SecretRecord[] = Object.entries(secrets).map(([key, value]) => ({
      spaceUri,
      spaceId,
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
    const secretRecord = await db.secrets
      .where('[spaceUri+spaceId+key]')
      .equals([spaceUri, spaceId, key])
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
    await db.secrets.put({
      spaceUri,
      spaceId,
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
    await db.secrets
      .where('[spaceUri+spaceId+key]')
      .equals([spaceUri, spaceId, key])
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


