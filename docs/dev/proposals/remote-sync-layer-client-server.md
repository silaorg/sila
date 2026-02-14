# Proposal: Remote Sync Layer (Client ↔ Server)

## Goal

Sync all RepTree ops through a remote layer between clients and a server.

The server runs `Backend` on loaded spaces. Client and server exchange ops via `SyncLayer`.

## Why this change

Today `SpaceManager` can compose multiple sync layers per space.

`SpaceRunner` already handles:
- loading ops from layers,
- saving local peer ops to layers,
- applying incoming ops from `startListening`.

So we can add a transport-focused remote layer without changing space/app logic.

## Existing experiments to reuse

We already have a working baseline in:
- `packages/client/src/lib/spaces/persistence/RemoteSpacePersistenceLayer.ts`
- `packages/server/src/socket.ts`

What is already implemented:
- Per-space socket namespace (`/spaces/:spaceId`) with auth gate.
- State-vector catch-up flow (`ops:state` -> `ops:sync` + `ops:sync:done`).
- Live op push flow (`ops:send` / `ops:receive`) for space and app trees.
- Server-side merge + persistence via server space layer.

Known gaps in current experiment:
- No explicit op validation before merge (`@TODO` in server handler).
- Limited ack/error semantics for client retries.
- Dedupe/echo control is implicit; should be made explicit in remote layer contract.

## Scope

- Add a `RemoteSyncLayer` implementation for client and server.
- Keep `SpaceManager` API (`setupSyncLayers`) as the integration point.
- Keep `Backend` unchanged. It should react when server space receives new ops.
- Keep file sync out of scope (ops only in this proposal).

## Proposed design

### 1) Transport contract

Use a persistent connection (WebSocket or Socket.IO). The layer exposes existing `SyncLayer` methods:

- `connect` / `disconnect`
- `loadSpaceTreeOps` and `loadTreeOps` for initial catch-up
- `saveTreeOps` to send local ops
- `startListening` to receive remote ops

### 2) Server role

For each space:
1. Server `SpaceManager` loads the space with local persistence + remote layer.
2. Remote layer accepts client ops and forwards them to `SpaceRunner` via `startListening` callback.
3. `SpaceRunner` applies ops to space trees.
4. `Backend` reacts to resulting tree updates.
5. Server broadcasts accepted ops to subscribed clients.

### 3) Client role

For each space:
1. Client `SpaceManager` uses local layer + remote layer.
2. On connect, client asks remote for missing ops since last cursor.
3. Client sends newly created local ops through `saveTreeOps`.
4. Client applies server-pushed ops from `startListening`.

### 4) Dedupe and loop prevention

Use op IDs as source of truth.

- Never rewrite incoming op IDs.
- Keep a short-lived `recentOpIds` cache in `RemoteSyncLayer`.
- Do not re-emit ops that were just received from the same connection.

This keeps current `SpaceRunner` peer filtering valid while avoiding echo loops.

### 5) Auth and access

Require auth on remote connect:
- identity,
- space access,
- permission mode (`read` / `write`).

Reject unauthorized write ops before they reach the server `SpaceRunner`.

## Minimal protocol (v1)

- `sync:hello` → `{ spaceId, peerId, lastKnownClock? }`
- `sync:load` → `{ treeId, since? }`
- `sync:ops` → `{ treeId, ops[] }`
- `sync:ack` → `{ receivedOpIds[] }`
- `sync:error` → `{ code, message }`

Notes:
- `since` can be a server cursor; start with timestamp if needed.
- Batch ops per tree.

## Implementation plan

1. Add `RemoteSyncLayer.ts` under `packages/core/src/spaces/sync`.
2. Implement client mode (connect, load, send, listen, dedupe cache).
3. Implement server mode handler that maps connection events to per-space remote layers.
4. Wire both sides via `SpaceManager.setupSyncLayers`.
5. Add integration tests: two clients + one server, verify op propagation and no loops.
6. Add auth checks in server handler before applying ops.

## Acceptance criteria

- Client A op appears in server space and triggers `Backend` observers.
- Same op is received by Client B.
- No infinite re-broadcast loop.
- Reconnect performs catch-up without full reload.
- Unauthorized client cannot push ops.

## Open questions

- Cursor format: server sequence number vs logical clock.
- Should server persist a compact per-client checkpoint.
- Do we want ordered delivery guarantees per tree in v1.
