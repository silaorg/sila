# Server-Side Space Storage (Local Disk)

## Summary

Store each space on the server disk under `packages/server/data/spaces/{spaceId}`.
Reuse the same on-disk layout used by `FileSystemPersistenceLayer`.
Keep the sync transport and auth from `workspaces-on-server-lite.md`.

## Goals

- Keep the existing space file layout.
- Keep files storage layout identical to local.
- Keep secrets format identical to local.
- Keep Socket.IO transport and JWT auth from the lite proposal.

## Non-Goals

- No S3 or object storage.
- No data migrations across space versions.
- No multi-region replication.

## Current Local Layout

`FileSystemPersistenceLayer` creates this layout:

```
<spacePath>/
  sila.md
  space-v1/
    space.json
    secrets
    ops/<treeId prefix>/<treeId suffix>/<yyyy>/<mm>/<dd>/<peerId>-{m|p}.jsonl
    files/
      static/sha256/
      var/uuid/
```

## Proposal

### Storage Root

Store spaces on the server file system in:

```
packages/server/data/spaces/{spaceId}
```

This matches the existing `packages/server/data` usage for SQLite.

### Server Layout

Keep the same folder structure, but store ops in a single SQLite file:

```
packages/server/data/spaces/{spaceId}/
  sila.md
  space-v1/
    space.json
    secrets
    ops.sqlite
    files/
      static/sha256/
      var/uuid/
```

### Persistence Layer

Reuse `FileSystemPersistenceLayer` on the server with a Node `AppFileSystem`
adapter. It should:

- Call `ensureDirectoryStructure()` for new spaces.
- Write ops to a local SQLite file instead of JSONL.
- Read ops from SQLite on startup or reconnect.
- Read and write secrets with the same AES-GCM scheme.

Use a Node-backed `AppFileSystem` implementation to avoid custom logic. Ensure
WebCrypto is available in Node for secrets (or provide a shim).

### In-Memory Space Management

Use `SpaceManager` on the server to manage loaded spaces in memory. It should:

- Load a space on first connect using a `SpacePointer` with the server path.
- Cache the `Space` instance per `spaceId` for reuse across sockets.
- Persist ops and secrets through the attached persistence layer(s).
- Close and evict idle spaces with a simple TTL (future improvement).

### Server Flow

- On `POST /spaces/:spaceId/connect`, ensure the space directory exists.
- On Socket.IO connect to `/spaces/{spaceId}`:
  - Verify the user has access to the space.
  - Load ops from disk for warm-start if needed.
- On `ops:send`, validate and append ops to disk.
- On `files` upload, store in `space-v1/files` using the same paths.

## Ops Validation

Reuse the validation checklist from `workspaces-on-server-lite.md`.
Reject invalid ops before writing to disk.
Log rejections with `userId`, `spaceId`, and reason.

## Migration

No migration needed for files. Ops move to SQLite.
If `space-v1` already exists, treat it as the source of truth for files.
If JSONL ops exist, we can offer a one-time import into `ops.sqlite`.

## Open Questions

- Do we need a per-space lock to prevent concurrent writes from multiple sockets?
- Do we need a compaction job for SQLite (vacuum or pruning)?
- Should the server expose a read-only export endpoint for backups?
