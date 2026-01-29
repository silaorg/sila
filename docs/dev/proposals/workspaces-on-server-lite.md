# Server-Side Workspaces (Local Files + Socket.IO)

## Executive Summary

Add a small server-side sync option for workspaces. Clients sync RepTree operations over Socket.IO and store files on the server’s local disk. The space file layout stays the same as the current file system format.

## Goals

- Keep the current space file storage layout.
- Use Socket.IO for real-time sync.
- Use token-based auth for all connections.
- Store files on local server disk. No S3.
- Add an ops validation layer that can reject unsafe ops.

## Non-Goals

- No full cloud storage platform.
- No object storage or CDN.
- No time estimates.

## Proposed Architecture

### Transport

- Socket.IO for real-time ops sync.
- One namespace per space, or a spaceId channel.
- Client sends a bearer token on connect.

### Auth

Auth flows through a platform service that hosts many workspaces.

- Platform service keeps a users database with workspace associations.
- One server can host many workspaces.
- User must sign in on the platform to access a workspace.
- Platform issues a JWT for workspace read/write.
- JWT uses platform database data (user, space id).
- Client prompts sign-in if no JWT is available.

**Endpoints**

- `api.silain.com/auth` issues JWTs for workspace access.
- `api.silain.com/space/{workspace-id}/` is the Socket.IO entry point.

### Ops Validation Layer

Add a server-side validation step before applying ops.

- **Permission checks**: validate user role for treeId, targetId, and app scope.
- **Abuse checks**: rate limit, max payload size, and invalid op patterns.
- **Rejection flow**: reject ops with a reason and do not persist them.
- **Audit trail**: log rejected ops with userId and reason.

## Storage Format

### Space File Structure (Same Format)

Keep the existing format. Store it on server disk.

```
<spacePath>/
  sila.md                    # User-readable description
  space-v1/
    space.json              # Space metadata
    secrets                 # Encrypted secrets file
    ops/                    # Operations organized by tree and date
      <treeId[0..1]>/
        <treeId[2..]>/
          <year>/
            <month>/
              <day>/
                <peerId>.jsonl  # Operations for each peer per day
    files/
      static/sha256/        # Immutable files by content hash
      var/uuid/             # Mutable files by UUID
```

### Server Storage Notes

- Each space maps to one server path.
- Files stay on local disk in `files/`.
- Ops are appended in `ops/` using the same JSONL format.

## Sync Flow

1. Client connects to Socket.IO with token.
2. Server validates token and space access.
3. Client sends ops batches.
4. Server validates each batch, then writes to `ops/`.
5. Server emits accepted ops to other clients.
6. File uploads use a separate HTTP endpoint or Socket.IO binary messages.

## Client Behavior Notes

- Client keeps local ops when connecting to a server workspace.
- Client stores ops locally (IndexedDB-like persistence).
- Client does not use backend logic for server workspaces (no AI agents).
