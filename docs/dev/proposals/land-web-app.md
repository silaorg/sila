# Land Web App with Neorest

Draft note: this proposal is a reference for direction and architecture discussion. It is not a strict spec that must be implemented 1 to 1.

## Summary

Add `packages/client` as the shared frontend client package and `packages/web` as a thin SvelteKit wrapper for hosted lands.

Serve its data from a small land web API that lives with `packages/silaland` and uses `neorest` for both request/response and live updates.

Reuse the thin-web-shell idea from v1, but do not bring back the old `client` / `core` / `server` split or the `socket.io` sync model.

The first version should support both:

- end users, who use browser-originated chats only
- admins, who use the same app and later get broader visibility across all channels

It should also fit a `users/` directory in the land so each user can have their own channels and, later, user-specific assistants, skills, and other configuration.

## Current State

- v2 is filesystem-first.
- `packages/silaland/src/land.js` starts channel runtimes in-process.
- thread data lives under `channels/<provider>/<thread-id>/`.
- there is no browser app or HTTP API yet.

Useful references:

- v1 `../sila/packages/web` was a thin SvelteKit wrapper.
- v1 `../sila/packages/server` exposed REST plus `socket.io`.
- `../neorest` already gives us GET/POST/DELETE routes plus subscriptions, reconnect, and HTTP fallback.

Likely direction for land layout:

- shared land-level runtime and config at the root
- `users/<user-id>/` for per-user channels and future per-user assistants, skills, and related files

## Problem

We want a hosted web app for a land, but we should not rebuild the old v1 stack just to get a UI.

If we add a normal REST API plus a separate WebSocket protocol, we will recreate the same duplication that `neorest` is meant to avoid.

## Goals

- add a hosted web UI in `packages/web`
- keep the UI thin and easy to explain
- use one API model for reads, writes, and live updates
- keep the filesystem thread runtime as the source of truth
- fit the direction of append-only thread events
- support a dedicated browser chat channel with one user-owned thread space per user
- leave room for per-user channels, assistants, and skills under `users/`

## Non-Goals

- porting the old v1 `client` / `core` / `server` architecture
- porting the old CRDT space sync model
- introducing a database for the web app
- solving full multi-tenant auth in the first step

## Proposed Design

### 1. `packages/client` and `packages/web`

Keep the same frontend split as old Sila:

- `packages/client` for shared UI and app logic
- `packages/web` as the thin SvelteKit wrapper

`packages/web` should stay small, similar in spirit to v1 `packages/web`:

- routing
- auth screen
- thread list
- thread detail view
- small app state around the current session and selected thread

Most durable frontend logic should move into `packages/client` over time, only as needed.
The server API should stay in `packages/silaland`.

The first product split should be:

- end-user view for browser chat only
- admin view for land operations and, later, cross-channel exploration

### 2. Add a land web API beside the land runtime

Add a small server module inside `packages/silaland`, for example:

- `packages/silaland/src/app-server.js`

This server should:

- open a `NodeRouter` from `neorest`
- expose read/write routes for land data
- broadcast live updates when thread state changes
- optionally run in the same process as `Land`

This keeps the architecture small:

- one land runtime
- one web API surface
- one browser app wrapper
- one shared client package

It should also understand both:

- land-level shared resources
- per-user resources under `users/<user-id>/`

### 3. Add a browser-native channel

Browser-originated chats should be their own channel, not a view over Slack or Telegram threads.

Suggested shape:

- `users/<user-id>/channels/app/`
- one app-thread namespace per authenticated user
- users can access only their own app threads
- admins can later inspect app threads and other provider threads through the same API

This keeps browser chat aligned with the existing land model:

- the browser is just another channel
- channel-specific policy stays in the runtime
- thread persistence stays under the land directory
- user-specific runtime data can live under that user's directory instead of being mixed into one global namespace

## 4. Use Neorest routes as the main app contract

Suggested first routes:

- `GET /status`
- `GET /me`
- `GET /threads`
- `GET /threads/:channel/:threadId`
- `POST /threads/:channel/:threadId/messages`
- `GET /threads/:channel/:threadId/events`

Suggested subscriptions:

- subscribe `/status`
- subscribe `/threads`
- subscribe `/threads/:channel/:threadId/events`

Shape:

- for end users, `GET /threads` should return only that user's app-channel threads
- admin routes can later widen scope to all channels
- `GET` returns the current snapshot
- subscription routes stream changes after that
- `POST /messages` creates an inbound app-channel message or outbound admin reply through the same land runtime instead of bypassing it

## 5. Keep the thread log as the source of truth

The web app should read from the same thread state the channel runtimes use.

That means:

- no separate web-only persistence layer
- no second message model for the browser
- no v1-style sync protocol

Short term:

- the API can project snapshots from the current thread files
- broadcasts can be coarse, for example "thread changed"

Target shape:

- append-only thread events in `messages.jsonl`
- API `GET` routes build snapshots from those events
- API subscriptions broadcast the new events directly

This fits the direction already described in `docs/dev/proposals/thread-runtime-simplification.md`.

## 6. Start with simple auth and role checks

Do not copy v1 auth yet, but do make the role split explicit from the start.

For the first version, use one of these simple models:

- reverse-proxy auth in front of the land instance
- one admin bearer token configured in the land
- short-lived session token issued by a minimal login route

`neorest` already accepts request headers, so bearer-token auth is enough for an MVP.

Required behavior:

- user identity maps to an app-channel thread scope
- user identity maps naturally to `users/<user-id>/`
- normal users can access only their own app-channel threads
- admin users can access broader land and channel views

This is enough for the first version without introducing a full account system.

## 7. Deployment shape

Recommended first deployment:

- build `packages/web`
- serve the built app with nginx or Caddy
- proxy API and `/.neorest` traffic to the land process

Why this first:

- `neorest` already handles API and live transport well
- `NodeRouter` already has normal HTTP route dispatch, but its Node adapter currently returns JSON responses only
- reverse proxy keeps app hosting simple without changing `neorest` first

Later, if we want a one-process deploy, we can extend `neorest`'s Node adapter with raw response, content-type, and static-file or fallback handling.

## Why this is simpler than v1

v1 had a thin web wrapper, but most of the complexity lived in:

- `packages/client`
- `packages/core`
- `packages/server`
- `socket.io` sync for shared space state

For v2 we should only reuse the good part:

- thin hosted web shell

We should not reuse:

- the heavy shared client stack
- the custom collaboration protocol
- the split between REST and socket events

## Implementation Plan

1. Add a minimal land app server in `packages/silaland` using `neorest`.
2. Add a small internal event bus so thread changes can broadcast to the API.
3. Define the `users/<user-id>/` land layout for per-user channels and future user-scoped resources.
4. Add an `app` channel runtime with user-scoped threads under each user.
5. Create `packages/client` for shared frontend logic and `packages/web` as the thin SvelteKit wrapper with user and admin views.
6. Expose a first API for `status`, `me`, `threads`, `thread detail`, and `messages`.
7. Align the API with append-only thread events so live updates become event-driven instead of snapshot-driven.
8. Document reverse-proxy deployment for the app and `/.neorest`.

## Risks

- current thread persistence is still snapshot-oriented, so the first live API may be coarser than the final model
- `neorest` does not yet give us static asset hosting, so same-process hosting would need extra work
- if we let the web app write directly to thread files, we could fork the runtime model
- role boundaries can get muddled if app-user and admin routes are not separated clearly
- land-level and user-level config can get confusing if the directory rules are not explicit

The main mitigation is to route all browser writes back through the land runtime and keep one thread lifecycle.

## Decisions

- the first web app is for both end users and admins
- browser-originated chats are their own user-scoped `app` channel
- the land should grow a `users/` directory for user-scoped channels and future assistants, skills, and config
- `packages/web` should use SvelteKit
- `packages/client` should hold shared frontend logic we may later reuse in desktop and mobile wrappers
