# Hosted Workspace App

Status: implemented foundation.

## Summary

The Heswe app is a thin SvelteKit client and server. The browser talks only to
same-origin HTTP endpoints and an event stream. It never opens a workspace
directory or runs an agent locally.

The server owns:

- authentication and sessions through Better Auth
- the SQLite user database
- access to the configured workspace
- user-scoped app threads
- live change notifications

The workspace filesystem remains the source of truth for agent configuration
and thread events. SQLite stores accounts and sessions only.

## Architecture

```text
browser
  ├── Better Auth routes
  ├── /api/workspace
  ├── /api/threads
  ├── /api/threads/:id
  ├── /api/threads/:id/messages
  └── /api/events (server-sent events)
          │
          ▼
SvelteKit server
  ├── Better Auth + SQLite
  └── AppWorkspaceService
          │
          ▼
workspace/users/<user-hash>/channels/app/<thread-id>/
  ├── state.json
  └── messages.jsonl
```

This is deliberately one deployable server and one API boundary. There is no
browser filesystem adapter, replicated tree, custom sync protocol, separate
WebSocket service, or client-side source of truth.

## Why HTTP plus server-sent events

Normal request/response HTTP handles reads and commands. A single
server-sent-events connection tells an authenticated browser when its thread
list or selected thread changed, and the client refetches that snapshot.

This is enough for one-way server notifications, uses browser-native reconnect,
works through ordinary HTTP proxies, and avoids maintaining a second command
protocol over WebSockets. If future features need low-latency bidirectional
streams, that requirement can be evaluated then.

## Authentication

Better Auth provides email/password accounts and cookie sessions. Its tables
live in a small SQLite database using WAL mode. Schema migrations run when the
server starts.

Every workspace endpoint resolves the current Better Auth session. User IDs are
hashed before they become directory names, and users can read or mutate only
their own app-channel threads.

The production server requires:

- `BETTER_AUTH_SECRET`: a stable, high-entropy secret
- `BETTER_AUTH_URL`: the public origin, for example `https://app.heswe.com`
- `WORKSPACE_PATH`: the absolute path of the served Heswe workspace

Optional:

- `HESWE_AUTH_DB_PATH`: SQLite path; defaults to `.data/heswe.sqlite`

The app and API should be served from the same origin. This keeps cookie policy,
CSRF protection, deployment, and local development straightforward.

## API

- `GET /api/workspace` returns the visible workspace identity.
- `GET /api/threads` lists the current user's app threads.
- `POST /api/threads` creates a current-user thread.
- `GET /api/threads/:threadId` projects thread messages from its event log.
- `POST /api/threads/:threadId/messages` routes a message through the agent
  runtime.
- `GET /api/events` opens an authenticated event stream for coarse invalidation.

The event stream never carries private data for another user. It sends only
events published with the connected user's ID.

## Persistence

Browser threads live under:

```text
users/<sha256-user-id>/channels/app/<thread-id>/
```

`messages.jsonl` is append-only. Each line is an event with its own ID and
timestamp. Reading a thread projects messages from those events. `state.json`
contains small mutable thread metadata such as its title and update time.

This avoids a second web-only message database while keeping authentication
records out of the workspace tree.

## Package boundaries

- `packages/heswe` owns workspace and agent behavior.
- `packages/client` owns reusable browser UI and the typed API client.
- `packages/web` owns the SvelteKit routes, Better Auth setup, SQLite connection,
  and deployment adapter.

The web package depends on the public `AppWorkspaceService` interface. It does
not reach into channel internals or write thread files directly.

## Deployment

Build the Node server:

```bash
npm run build -w web
```

Run the generated server with the required environment:

```bash
WORKSPACE_PATH=/srv/heswe/workspace \
BETTER_AUTH_URL=https://app.heswe.com \
BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
node packages/web/build
```

Persist both the workspace and SQLite database. Put the Node server behind an
HTTPS reverse proxy that does not buffer `text/event-stream` responses.

## Deliberate limits

- Signup is open when email/password auth is enabled. Invitation-only workspaces
  will need an explicit enrollment policy.
- Live events currently invalidate snapshots rather than streaming agent tokens.
- One Node process owns the in-memory event fanout. Multi-instance deployment
  will need a shared pub/sub transport.
- Admin views, password recovery email, OAuth, and account management are later
  product decisions, not hidden abstractions in this foundation.
