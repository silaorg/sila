# Spaces in Sila

A space is the primary unit of user data in Sila. It holds the state of the workspace (name, settings, app configurations) and any number of application-specific trees ("AppTrees") such as chat threads or a files library. All state is modeled as CRDT operations via RepTree and can be persisted to different storage layers.

## Core concepts

- **RepTree (CRDT)**: Every space and app tree is a RepTree instance. RepTree stores a tree of vertices with properties. All changes are represented as immutable operations (ops) with Lamport-style IDs and peer IDs. RepTree merges ops from multiple sources deterministically and deduplicates them by op ID.
- **Space tree**: The root RepTree for a space. It contains global vertices such as `app-configs`, `app-forest` (references to app trees), `providers`, and `settings`.
- **App trees**: Additional RepTree instances created for specific features. Today we commonly use:
  - Chat trees (one per conversation)
  - Files trees (logical view of files/metadata)
- **Persistence layers**: Pluggable backends that store and load RepTree ops and secrets. We support multiple layers per space (e.g., IndexedDB and FileSystem) and merge ops from them.

## RepTree in practice

- A RepTree is a CRDT-backed tree with a single root vertex. Vertices have:
  - A unique `id` (string)
  - Optional `name` (string) used to form paths like `app-configs` or `messages`
  - Arbitrary properties (numbers, strings, booleans, arrays, objects)
- Changes are transformed into **operations** (move vertex, set property) with IDs that include the authoring peer ID. RepTree:
  - Merges ops from any source using CRDT rules
  - Deduplicates ops by ID
  - Reconstructs the latest tree state from the op set

Developers interact with vertices at a high level (e.g., `setProperty`, `newNamedChild`); RepTree emits ops underneath.

## Trees in a space

- **Space tree (single)**
  - Root metadata and global collections (e.g., `app-configs`, `providers`, `settings`)
  - `app-forest` holds references to app trees by storing each app tree ID (tid) in a child vertex
- **App trees (many)**
  - Each app tree is its own RepTree with its own root and ops
  - Created via `Space.newAppTree(appId)` where `appId` identifies the kind of app (e.g., `default-chat`)
  - Loaded on demand via a registered tree loader

### Examples

- Chat tree
  - Root stores the chat config ID and contains a `messages` branch. Messages are vertices with properties `{ _n: "message", text, role, createdAt, ... }`.
- Files tree
  - Root is marked with `appId: 'files'` and `name: 'Files'` and contains a logical `files` folder. Child vertices represent folders and files (with metadata such as `hash`, `mimeType`, `size`). Bytes are not stored in ops.

## Persistence

Spaces can use one or more persistence layers:

- **IndexedDB (browser)**: Stores ops locally in the browser
- **FileSystem (desktop)**: Stores ops and secrets under `<spaceRoot>/space-v1/`
  - Ops are written as JSONL files, batched by day and peer
  - Secrets are encrypted and stored as a single file (`space-v1/secrets`)

The `SpaceManager` coordinates persistence:

- On create/add: connects layers, saves initial ops, and sets up tracking
- On load: connects layers in parallel, loads ops using a race (first layer to respond) then merges ops from the rest
- Syncs ops between layers to converge when some layers lag behind
- Tracks new app trees and incremental ops and saves them to all layers
- Wires secrets saving (`space.setSecret`, `space.saveAllSecrets`) to persist across layers

### Two-way sync (optional)

Some layers (e.g., FileSystem) can listen for changes. The manager applies incoming ops to the appropriate tree. CRDT merging in RepTree ensures convergence.

### Transient properties

UI may set transient properties (e.g., previews) that should not be persisted. The FileSystem layer filters out ops marked as transient so they never hit disk.

## Referencing between trees

Trees can reference each other by ID. The space tree keeps a list of app trees in `app-forest` and stores each app tree ID (tid). App trees may include JSON references to other trees (e.g., a chat message referencing a file vertex in a Files AppTree by `{ file: { tree: filesTreeId, vertex: fileVertexId } }`).

## Secrets

Per-space secrets (e.g., API keys) live outside RepTree ops. They are encrypted at rest by the FileSystem layer and loaded into the `Space` process memory. The `SpaceManager` wraps setters to save secrets to all layers.

## Best practices for developers

- **Choose the right tree**: Use the space tree for global workspace state; create app trees for domain-specific state (chat threads, files library, etc.).
- **Model as vertices + properties**: Prefer structured vertex properties over large blobs; RepTree ops are efficient for structured data.
- **Avoid blobs in ops**: Store binary data outside CRDT (e.g., via FileStore on desktop) and keep only references in trees.
- **Load lazily**: Register a tree loader and load app trees on demand to keep memory use low.
- **Observe carefully**: Use RepTree observation utilities for UI updates; prefer transient properties for ephemeral UI state.
- **Multiple layers**: Provide both a fast local layer (IDB) and a durable layer (FS) when available. Let `SpaceManager` merge and sync.

## Summary

Spaces provide a CRDT-first, multi-tree data model. RepTree gives deterministic merging and offline-friendly ops, while `SpaceManager` orchestrates persistence across layers and app trees. Keep structures small and composable, use app trees to separate concerns, and store large binary data outside CRDT with references from tree metadata.