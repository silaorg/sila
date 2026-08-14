# How the hosted app works

The Heswe app is a SvelteKit server and browser client. The browser uses
same-origin HTTP endpoints and one server-sent events connection. It never
reads a workspace directory or runs an agent locally.

```text
browser
  -> SvelteKit API and Better Auth
    -> user workspace registry
      -> AppWorkspaceService
        -> workspace/users/<user-hash>/channels/app/<thread-id>/
```

`packages/client` owns the shared Svelte interface and API client.
`packages/web` owns routes, authentication, SQLite, and server-sent events.
`packages/heswe` owns workspace storage and agent execution.

Shared files live under `workspace/assets/`. App uploads live under the
authenticated user's thread at `files/YYYY/MM/DD/`. The browser works with
scoped references such as `workspace:assets/brief.md` and never receives
absolute server paths.

## Local development

Run the app from the repository root:

```sh
npm run dev
```

The launcher reserves the first available API/dashboard port pair. The first
instance uses API port `39900` and dashboard port `39901`. Later instances try
`39902/39903`, `39904/39905`, and so on. If either port is unavailable, the
whole pair is skipped. `npm run dev:ports` prints the selected URLs for every
running instance in the current checkout.

Heswe still has one SvelteKit application server. It owns the API port and
serves the UI, API, authentication, and event stream. The local dashboard port
is a proxy to that server, which keeps browser requests same-origin without
duplicating application state. Run `npm run dev:api-only` to omit the dashboard
proxy.

The launcher keeps local workspaces and authentication data under `.data/`.
Set `WORKSPACES_PATH` or `HESWE_AUTH_DB_PATH` only when custom locations are
needed.

## Authentication

Better Auth provides email and password accounts with cookie sessions. SQLite
with WAL mode stores accounts, sessions, workspace ownership, and each user's
current workspace. Agent threads and files remain in workspace directories.

Every workspace request requires a session. A new account has no workspace.
The user creates one in the app and can only list or select workspaces they
own. Server-generated IDs form directory names beneath `WORKSPACES_PATH`; API
responses never expose those paths. Better Auth user IDs are hashed again
inside each workspace before use as thread directory names.

Production requires:

- `BETTER_AUTH_SECRET`: a stable, high-entropy secret of at least 32 characters.
- `BETTER_AUTH_URL`: the public origin, such as `https://app.heswe.com`.
- `WORKSPACES_PATH`: the parent directory for user-created workspaces.
- `HESWE_WORKSPACE_IMAGE`: the reviewed workspace runtime image tag.
- `HESWE_SANDBOX_NETWORK`: a dedicated Docker network with controlled egress.

`HESWE_AUTH_DB_PATH` optionally changes the SQLite path. It defaults to
`.data/heswe.sqlite`. Development can inherit provider keys from the server.
Production provider keys belong in each workspace's settings.

## API and live updates

- `GET` and `POST /api/workspaces` list and create owned workspaces.
- `POST /api/workspaces/:id/select` selects an owned workspace.
- `GET` and `POST /api/workspaces/:id/threads` list and create user threads.
- `GET /api/workspaces/:id/threads/:threadId` returns one projected thread.
- `GET /api/workspaces/:id/files` searches shared assets and the current
  thread's uploads for `@` mentions.
- `GET /api/workspaces/:id/files/content` streams an authorized file.
- `POST` and `DELETE /api/workspaces/:id/threads/:threadId/files` add or remove
  unsent thread uploads.
- `POST /api/workspaces/:id/threads/:threadId/messages` sends a message through
  the agent runtime.
- `GET /api/events` opens the authenticated event stream.

Commands use normal HTTP. Thread URLs include the workspace ID, so concurrent
tabs cannot accidentally act on another tab's selected workspace. The event
stream sends user- and workspace-scoped invalidation events, and the client
refetches the affected snapshot. It does not stream private event records or
model tokens.

Thread API projections expose message IDs, timestamps, roles, display text,
and attachment metadata with scoped references. They do not expose absolute
filesystem paths, raw log events, tool details, or internal message metadata.
Server logs record message lengths and lifecycle events, not conversation
content.

## Deployment

Install Docker and configure gVisor as Docker's `runsc` runtime. Build the
reviewed workspace image:

```sh
docker build -f Dockerfile.workspace -t heswe-workspace-runtime:0.1.0 .
docker network create \
  --driver bridge \
  --opt com.docker.network.bridge.enable_icc=false \
  heswe-sandboxes
```

Apply host firewall rules to that network which reject the Docker host,
private infrastructure, and cloud metadata addresses while allowing the
public HTTPS egress agents need. The API user needs access to Docker and the
workspace tree. Run it as UID/GID `10001` by default, and make the persistent
directories owned by that user.

Build and run the Node server:

```sh
npm run build -w web

WORKSPACES_PATH=/srv/heswe/workspaces \
HESWE_WORKSPACE_IMAGE=heswe-workspace-runtime:0.1.0 \
HESWE_SANDBOX_NETWORK=heswe-sandboxes \
BETTER_AUTH_URL=https://app.heswe.com \
BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
node packages/web/build
```

Production uses `runsc` automatically. `HESWE_SANDBOX_DRIVER=process` is
accepted only by the development build. Provider keys are saved per workspace
through its settings instead of being inherited from the API process.

Persist the workspace parent directory and SQLite database. Back them up
together so ownership records and workspace directories remain consistent.
Use HTTPS, keep the app and API on one origin, and disable reverse-proxy
buffering for `text/event-stream`.

The current event broker is in memory, so one Node process must own a user's
live connections. Multiple server instances will require shared pub/sub.
