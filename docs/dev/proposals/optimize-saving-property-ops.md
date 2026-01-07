# Optimize saving property ops

## Summary
Save move ops and property ops in separate files. Append all move ops. Keep only the latest property ops per key in the property file. This reduces disk usage without changing tree replication rules.

## Motivation
Move ops must keep full history to replay tree moves. Property ops use last-write-wins. Old property ops are safe to drop when a newer opId for the same key exists.

## Proposal
- Write two files per peer in a workspace:
  - `{peerId}-m.jsonl`: append-only move ops.
  - `{peerId}-p.jsonl`: append property ops, then compact to keep only the newest opId per property key.
- Only the peer that owns the files can compact its `{peerId}-p.jsonl`.
- Update the ops entries to omit the `"p"` and `"m"` type prefix because each file is already type-specific.

## Persistence flow
1. On save, append new move ops to `{peerId}-m.jsonl`.
2. On save, append new property ops to `{peerId}-p.jsonl`.
3. Periodically compact `{peerId}-p.jsonl`:
   - Read all property ops.
   - Keep the newest opId per `(nodeId, propertyKey)`.
   - Sort the kept ops by opId.
   - Rewrite `{peerId}-p.jsonl` with the kept ops.
4. Trigger compaction when either threshold is hit:
   - `propOpsSinceCompact >= 500`
   - `propsFileBytes >= 1_000_000`

## Load flow
- Load move ops from `{peerId}-m.jsonl` and replay in order.
- Load property ops from `{peerId}-p.jsonl` and apply LWW logic.
