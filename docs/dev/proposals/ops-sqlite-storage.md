# Ops Storage in SQLite (Server)

## Summary

Store all space ops in a single SQLite file: `space-v1/ops.sqlite`.
Keep files on disk in the same layout as local (`space-v1/files`).
This replaces JSONL ops on the server only.

## Goals

- Keep file storage layout identical to local.
- Store ops in SQLite for simpler queries and compaction.
- Keep secrets format identical to local.
- Keep Socket.IO transport and auth unchanged.

## Non-Goals

- Replace local JSONL format.
- Implement full migration tooling.
- Add cloud object storage.

## Server Layout

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

## Proposed Schema (High Level)

- `ops` table: stores all ops for all trees in the space.
- Columns: `tree_id`, `peer_id`, `counter`, `op_type`, `target_id`, `key`, `value`, `ts`.
- Indexes on (`tree_id`, `peer_id`, `counter`) and (`tree_id`, `ts`).

## Write Path

- On `ops:send`, validate ops, then insert in a single transaction.
- Keep JSONL out of the server flow.

## Read Path

- On space load, read ops by `tree_id` ordered by (`peer_id`, `counter`) or by `ts`.
- Optionally read incremental ops since a checkpoint.

## Persistence Layer

- Implement a server-only `SQLiteOpsPersistenceLayer`.
- Reuse the existing file store provider for `space-v1/files`.
- Keep secrets reading/writing identical to local.

## Migration (Optional)

- If JSONL exists, offer a one-time import into `ops.sqlite`.
- If `ops.sqlite` exists, treat it as source of truth.

## Open Questions

- Do we need a per-space write lock for concurrent sockets?
- What op ordering is required for deterministic rebuild?
- Do we need periodic vacuum/compaction?
