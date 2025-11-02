## Proposal: Update space structure and "app instances"

### Motivation

- **Simpler naming**: Replace "app forest" with **app instances**. The term matches what users see (instances of apps) and aligns better with typed APIs.
- **Composable spaces**: Treat a **space** as just another app kind that can reference other apps (including other spaces). This unifies how we mount and navigate everything.
- **Clear visibility**: First‑class support for public/private groupings that drive what appears in the sidebar.
- **File semantics**: Split file storage into immutable content‑addressed files and mutable uuid‑addressed blobs.

### High‑level model

- **Root space tree** (single root space per workspace)
  - Global metadata (settings, providers, app‑configs)
  - `users/` branch containing user space references
  - `app-instances` for root-level app instances (shared across users)
  - Organization: `users/`, `app-configs/`, `app-instances/{public,private}`

- **User space tree** (one per user)
  - User-specific metadata and settings
  - `app-instances` for user-owned app instances
  - **No `users/` branch** - user spaces don't contain other users
  - Organization: `app-configs/`, `app-instances/{public,private}`, `settings/`

- **App instances (many)**
  - Each instance points to an app kind and its app tree (or a nested space)
  - Instances can live under `public` or `private` for simple visibility in UI

- **Space as an app**
  - An app kind `space` whose instance mounts another space by id
  - Root space contains user spaces; user spaces don't contain other spaces

### Example structure (conceptual)

```
root-space
  - users
      - dmitry  (app kind: space, points to user space)
      - alice   (app kind: space, points to user space)
  - app-configs
  - app-instances
      - public
          - shared-chat  (shared across all users)
      - private
          - admin-tools  (root-only tools)

user-space (dmitry)
  - app-configs
  - app-instances
      - public
          - chat-1
          - files-1
      - private
          - secrets-1
  - settings
```

### UI implications

- **Sidebar**: On selecting a user, load `public` from both the root space and the selected user space; render user space items primarily, with root space items mixed in as applicable.
- **Space viewer tab**: Add a tab to visualize any space as a vertex tree (like a Linux FS). Useful for debugging or power usage.

### TreeSpec: Tree structure definitions

A **TreeSpec** defines the expected structure and schema of a RepTree. TreeSpecs are referenced by app instances and used by typed tree wrappers to validate and provide convenient access patterns. This builds on the existing RepTree CRDT system while adding structure validation.

#### TreeSpec model

```ts
interface TreeSpec {
  id: string;                    // unique identifier (e.g., 'chat-v1', 'files-v1')
  version: string;               // semantic versioning
  appKind: string;               // associated app kind (e.g., 'chat', 'files', 'space')
  schema: VertexSchema;          // expected vertex structure
  requiredPaths: string[];       // required named children under root
  optionalPaths: string[];       // optional named children
  migrations?: Migration[];      // version-to-version migrations
}

interface VertexSchema {
  root: PropertySchema;          // root vertex properties (e.g., configId, title)
  messages?: PropertySchema;     // message vertex properties (_n: 'message', text, role, etc.)
  files?: PropertySchema;        // file vertex properties (_n: 'file', hash, mimeType, etc.)
  jobs?: PropertySchema;         // job vertex properties (_n: 'job', status, etc.)
  // ... other vertex types
}

interface PropertySchema {
  required: Record<string, PropertyType>;
  optional: Record<string, PropertyType>;
}

type PropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: (tree: RepTree) => Promise<void>;
}
```

#### TreeSpec registration and usage

```ts
// Register TreeSpecs globally
TreeSpecRegistry.register(ChatTreeSpec);
TreeSpecRegistry.register(FilesTreeSpec);
TreeSpecRegistry.register(SecretsTreeSpec);

// App instances reference TreeSpecs
interface AppInstanceRef {
  id: string;
  name?: string;
  appKind: 'chat' | 'files' | 'space' | 'secrets' | string;
  treeSpecId?: string;           // references TreeSpec
  treeId?: string;               // for normal app trees
  spaceId?: string;              // for appKind === 'space'
  configId?: string;
  visibility?: 'public' | 'private';
  createdAt?: number;
  icon?: string;
}
```

#### Typed tree wrappers

TreeSpecs enable typed tree wrappers that provide convenient, validated access:

- **ChatTree**: typed interface for messages, attachments, refs to files
- **FilesTree**: typed interface for file metadata and organization  
- **SecretsTree**: lightweight tree that references encrypted secrets
- **RootSpaceTree**: typed accessors for `app-configs`, `app-instances`, `users`, `providers`, `settings` (root space only)
- **UserSpaceTree**: typed subset for user‑owned app instances and settings (user spaces only)

#### Tree validation and migration

When a tree connects to a TreeSpec:

1. **Validation**: Check that required paths exist and vertex properties match schema
2. **Branch creation**: If required branches are missing, create them automatically
3. **Migration**: If tree version differs from TreeSpec version, run migrations in sequence
4. **Exception**: If validation fails and no migration path exists, throw descriptive error

```ts
// Example: ChatTree connecting to a tree
class ChatTree {
  constructor(private appTree: AppTree) {
    const treeSpec = TreeSpecRegistry.get('chat-v1');
    const validation = treeSpec.validate(appTree.tree);
    
    if (!validation.valid) {
      if (validation.migratable) {
        treeSpec.migrate(appTree.tree, validation.currentVersion);
      } else {
        throw new Error(`Invalid chat tree: ${validation.errors.join(', ')}`);
      }
    }
  }
  
  // Typed accessors that work with RepTree vertices
  get messages(): Vertex[] { 
    return this.appTree.tree.getVertexByPath('messages')?.children || [];
  }
  
  get configId(): string { 
    return this.appTree.tree.root?.getProperty('configId') as string;
  }
  
  newMessage(role: string, content: string): Vertex {
    const messagesVertex = this.appTree.tree.getVertexByPath('messages');
    if (!messagesVertex) {
      // Create messages branch if it doesn't exist
      this.appTree.tree.newNamedVertex(this.appTree.tree.root!.id, 'messages', {});
    }
    
    const messageVertex = this.appTree.tree.newNamedVertex(messagesVertex.id, 'message', {
      text: content,
      role: role
    });
    
    return messageVertex;
  }
}
```

#### App separation from trees

This creates a clear separation:

- **TreeSpec**: Defines what a tree should look like (schema, structure)
- **Tree wrapper**: Provides typed, validated access to tree data (ChatTree, FilesTree)
- **App backend**: Business logic that uses tree wrappers (ChatAppBackend)
- **App UI**: Components that use app backends (ChatApp.svelte)

Apps can hook to any tree that matches their TreeSpec, enabling:
- Multiple chat apps using the same chat tree
- File management apps using files trees
- Migration between different app implementations
- Testing with mock tree implementations

### App instance model

Conceptual interface for the child vertex under `app-instances`:

```ts
interface AppInstanceRef {
  id: string;                 // vertex id
  name?: string;              // display name
  appKind: 'chat' | 'files' | 'space' | 'secrets' | string;
  treeId?: string;            // for normal app trees
  spaceId?: string;           // for appKind === 'space'
  configId?: string;          // link to app-configs
  visibility?: 'public' | 'private';
  createdAt?: number;
  icon?: string;
}
```

Notes:
- `app-instances` replaces `app-instances` everywhere in code and docs.
- Cross‑space references should always carry `{ spaceId, treeId, vertexId }` to be unambiguous.

### Loading model

- On app start with a selected root space and user space:
  - Load root space tree and its `public` app instances.
  - Load selected user space tree and its `public` app instances.
  - Resolve app trees lazily when tabs/views request them.
- User spaces (instances with `appKind: 'space'` in root space) are mounted on demand via `spaceId`.
- Root space contains user management; user spaces contain user-specific apps and data.

### Files: immutable vs mutable stores

Building on the existing CAS system, we extend the file storage to support both immutable and mutable blobs:

On disk under the space root:

```
space-v1/
  files/
    static/sha256/{hash[0:2]}/{hash[2:]}     # immutable CAS structure
    var/uuid/{uuid[0:2]}/{uuid[2:]}          # mutable storage with UUID splitting
```

- **static/sha256/**: content‑addressed, immutable, deduplicated (current CAS behavior via FileStore).
- **var/uuid/**: uuid‑addressed blobs intended for values that may be rotated/overwritten (e.g., encrypted secret bundles, thumbnail caches, temporary data).

#### Integration with existing FileStore

```ts
interface FileStore {
  // Existing CAS methods
  putDataUrl(dataUrl: string): Promise<{ hash: string; size: number }>;
  putBytes(bytes: Uint8Array): Promise<{ hash: string; size: number }>;
  exists(hash: string): Promise<boolean>;
  getBytes(hash: string): Promise<Uint8Array>;
  getDataUrl(hash: string): Promise<string>;
  delete(hash: string): Promise<void>;
  
  // New mutable storage methods
  putMutable(uuid: string, bytes: Uint8Array): Promise<void>;
  getMutable(uuid: string): Promise<Uint8Array>;
  existsMutable(uuid: string): Promise<boolean>;
  deleteMutable(uuid: string): Promise<void>;
}
```

#### Integration patterns:
- Files AppTree continues to reference immutable hashes for user files (unchanged).
- SecretsTree stores metadata pointing to encrypted bundles at `mutable/uuid/{secretBundleId}`.
- Consider versioning for mutables: `mutable/uuid/{id}/{version}` if we need history later.
- Mutable storage integrates with existing `sila://` protocol for serving.

### Secrets handling (lightweight)

Building on the existing secrets system in SpaceManager and FileSystemPersistenceLayer:

- Keep encryption outside CRDT ops. Store only references and minimal metadata in the tree.
- Write encrypted payloads to `space-v1/files/var/uuid/{secretBundleId[0:2]}/{secretBundleId[2:]}`.
- Provide `space.setSecret(key, value)` and `space.getSecret(key)` backed by the secrets app instance.
- Piggyback on existing per‑space key material (already handled by FileSystemPersistenceLayer).

#### SecretsTree implementation

```ts
class SecretsTree {
  constructor(private appTree: AppTree, private space: Space) {
    // Validate against SecretsTreeSpec
  }
  
  async setSecret(key: string, value: string): Promise<void> {
    const uuid = crypto.randomUUID();
    const encrypted = await this.encrypt(value);
    
    // Store encrypted data in mutable storage
    const fileStore = this.space.getFileStore();
    if (fileStore) {
      await fileStore.putMutable(uuid, new TextEncoder().encode(encrypted));
    }
    
    // Ensure secrets branch exists and store reference in tree
    let secretsVertex = this.appTree.tree.getVertexByPath('secrets');
    if (!secretsVertex) {
      secretsVertex = this.appTree.tree.newNamedVertex(this.appTree.tree.root!.id, 'secrets', {});
    }
    
    const secretVertex = this.appTree.tree.newNamedVertex(secretsVertex.id, 'secret', {
      key: key,
      uuid: uuid
    });
  }
  
  async getSecret(key: string): Promise<string | undefined> {
    const secretsVertex = this.appTree.tree.getVertexByPath('secrets');
    if (!secretsVertex) return undefined;
    
    const secretVertex = secretsVertex.children.find(v => 
      v.getProperty('key') === key && v.getProperty('_n') === 'secret'
    );
    
    if (!secretVertex) return undefined;
    
    const uuid = secretVertex.getProperty('uuid') as string;
    const fileStore = this.space.getFileStore();
    if (!fileStore) return undefined;
    
    const encrypted = await fileStore.getMutable(uuid);
    return await this.decrypt(new TextDecoder().decode(encrypted));
  }
}
```

### Visibility and discovery

- Use `visibility: 'public' | 'private'` on app instance vertices and optionally group under named branches for fast queries.
- Sidebar populates from `public` of the active user space plus root space `public`.

### Migration plan (incremental)

1) **TreeSpec framework**: Implement TreeSpec registry and validation system alongside existing app tree creation.
2) **App instances**: Introduce `app-instances` while continuing to populate `app-instances` as an alias.
3) **Tree wrappers**: Create ChatTree wrapper and migrate ChatAppBackend to use it instead of direct AppTree access.
4) **Mutable storage**: Add mutable/uuid store alongside existing `sha256` CAS; extend FileStore interface.
5) **SecretsTree**: Implement SecretsTree as optional; migrate existing secrets persistence from SpaceManager to it.
6) **UI updates**: Update loaders/UI to read from `app-instances` first, fallback to `app-instances`.
7) **Testing**: Migrate tests and docs to new naming and TreeSpec validation.
8) **Cleanup**: Flip default to `app-instances`; remove `app-instances` after deprecation window.

### Affected areas (high‑level)

- **Core spaces API**: rename `app-instances` to `app-instances` in Space.ts and add typed wrappers.
- **TreeSpec system**: implement TreeSpec registry, validation, and migration framework in core.
- **Tree wrappers**: create ChatTree, FilesTree, SecretsTree with typed accessors that work with RepTree vertices.
- **App backends**: refactor ChatAppBackend to use ChatTree wrapper instead of direct AppTree access.
- **Space loader/manager**: support nested spaces as app instances; parallel loading for root+user spaces.
- **File system layer**: extend FileStore interface and FileSystemFileStore to support mutable/uuid storage.
- **Persistence layers**: update FileSystemPersistenceLayer to handle mutable file storage.
- **UI**: sidebar query; space viewer tab; terminology updates in client package.
- **Tests**: update space and chat tests to new instance path; add tests for nested spaces, visibility, and TreeSpec validation.
- **Docs**: replace terminology and add guidance on public/private, file stores, and TreeSpec usage.

### Open questions

- **ACLs**: Do we need per‑instance ACLs beyond public/private in a single‑user app today?
- **Mutable versioning**: Should mutable blobs support versioning natively or via separate metadata?
- **UI navigation**: How do we present nested spaces in the UI without clutter? Collapsed mounts? Breadcrumbs?
- **Instance mobility**: Do we allow app instances to move between root and user spaces seamlessly (preserving ids)?
- **TreeSpec evolution**: How do we handle TreeSpec changes that affect existing trees? Migration paths vs breaking changes?
- **Performance**: How do TreeSpec validation and migration impact tree loading performance?
- **Backward compatibility**: How long do we maintain support for old tree structures without TreeSpecs?

### Next steps

- **TreeSpec framework**: Implement TreeSpec registry, validation, and migration system.
- **ChatTree wrapper**: Create ChatTree with typed accessors and migrate ChatAppBackend to use it.
- **App instances**: Prototype `app-instances` alias and typed wrappers in core.
- **Mutable storage**: Add `mutable/uuid` store with a minimal API and wire a basic `SecretsTree` to it.
- **Space viewer**: Build a simple Space Viewer tab to render a space's vertices for inspection.
- **Testing**: Update tests and docs; run both naming schemes during transition.

### Appendix: example vertex paths

```
/ (root space tree root)
  app-configs/
  app-instances/
    public/
      shared-chat { appKind: 'chat', treeId: 't-shared-chat', treeSpecId: 'chat-v1' }
    private/
      admin-tools { appKind: 'admin', treeId: 't-admin', treeSpecId: 'admin-v1' }
  users/
    dmitry { appKind: 'space', spaceId: 'space-user-dmitry', treeSpecId: 'space-v1' }
    alice { appKind: 'space', spaceId: 'space-user-alice', treeSpecId: 'space-v1' }
  providers/
  settings/

/ (user space tree root - dmitry)
  app-configs/
  app-instances/
    public/
      chat-1 { appKind: 'chat', treeId: 't-chat-1', treeSpecId: 'chat-v1' }
      files-1 { appKind: 'files', treeId: 't-files-1', treeSpecId: 'files-v1' }
    private/
      secrets-1 { appKind: 'secrets', treeId: 't-secrets-1', treeSpecId: 'secrets-v1' }
  settings/
```

### Integration with existing systems

This proposal builds on and extends existing Sila systems:

- **RepTree CRDT**: TreeSpecs add structure validation to the existing CRDT system
- **SpaceManager**: Extends to handle root/user space hierarchy and parallel loading
- **FileStore**: Extends with mutable storage while preserving existing CAS
- **Persistence layers**: FileSystemPersistenceLayer extended for mutable files
- **App trees**: Existing app tree creation and loading patterns preserved
- **File protocol**: `sila://` protocol extended to serve mutable files
- **Space hierarchy**: Root space manages users; user spaces contain user-specific data

