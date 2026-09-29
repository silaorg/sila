# Neorest integration pilot

The `feat/neorest` branch replaces the app's SSE connection with Neorest.
The release cleanup was committed and pushed to `v2` first as `b8e8cae7`.

Neorest is a good fit for authenticated subscriptions, reconnects, and a
WebSocket transport with HTTP fallback. This pilot uses those features for
thread, workspace, and file invalidations. Commands and file transfers keep
using the existing SvelteKit HTTP endpoints. Voice and HTTP/3 are not enabled.

## Layout

- `vendor/neorest` is a pinned submodule. The app links its runtime package
  through `file:` dependencies and builds it during `npm ci`.
- `AppEventBroker` broadcasts to `/users/:userId/events`. The native cookie
  handshake establishes immutable identity; subscriptions and deliveries check
  ownership and current session validity.
- Vite's realtime plugin and the production `packages/web/server.mjs` share
  the same Neorest HTTP and upgrade handlers at `/.neorest`.
- `workspace-events.ts` restores snapshots after reconnect. Broadcasts are
  transient invalidations, so the normal HTTP API remains the source of truth.
- The development launcher already forwards WebSocket upgrades. Direct Vite
  launches default the auth origin to their local API port.

Neorest is pinned to `3cf1133` on `feat/heswe-source-integration`. The upstream
change moves the optional HTTP/3 test dependencies from Neorest's
runtime package into its test workspace. This prevents local `file:` consumers
from pulling native test build tools into their main dependency install.

The follow-up fixes cancel in-flight HTTP work on close, ignore responses from
old sessions, and share concurrent handshakes. Reconnect only reports success
once every subscription is restored; denied subscriptions consume the bounded
retry budget rather than leaving a falsely healthy connection. Six regression
cases reproduce these lifecycle failures.

## Validation on September 28 and 29, 2026

Using Node.js 22.20 on macOS:

- All 218 app tests pass. Coverage includes HTTP, WebSocket, auto fallback, cross-user subscription
  rejection, revoked-session delivery, malformed events, and client cleanup.
- The browser received a newly created thread without reload. A second thread
  created while the browser was offline appeared automatically after reconnect.
- The production entrypoint served the app, accepted cookie signup, rejected an
  anonymous realtime connection, accepted an authenticated WebSocket
  subscription, and exited cleanly on SIGTERM. Docker readiness was stubbed for
  this host-only smoke test; it did not run an agent.
- Frontend checks report zero errors and warnings. The production build passes
  with existing dependency and chunk-size warnings.
- Fresh development and production (`--omit=dev`) installs build both source
  dependencies successfully. Production imports and native SQLite pass.
- All 57 upstream Neorest tests pass, including the real native HTTP/3 test.
  The earlier missing-binary failure was resolved by explicitly building the
  optional provider before running the full upstream suite:

  ```sh
  npm rebuild --prefix vendor/neorest @fails-components/webtransport-transport-http3-quiche
  npm test --prefix vendor/neorest
  ```

  HTTP/3 remains disabled in Heswe; its normal dependency build skips native
  provider installation scripts.

The [September 29 cleanup](tidy-review-2026-09-29.md) adds two regression cases
and simplifies subscription and callback ownership.

## Deployment and decisions

Run `node packages/web/server.mjs` (or `npm run start -w web`), not the generated
adapter entrypoint. Forward WebSocket upgrades and held HTTP polls at
`/.neorest`. Configure `BETTER_AUTH_URL` to the exact public origin.

The broker still lives in one process. Horizontal scaling needs a shared
pub/sub service; Neorest does not supply durable event history or cross-host
workspace placement. Linux/gVisor execution and proxy behavior need a real
staging deployment before release.

Suggested next decision: keep this small subscription integration for the
release, or expand Neorest to typed command routes in a later iteration. The
small integration is easier to validate now. Voice transport, shared workspace
presence, and durable resumable event streams should follow concrete product
requirements.
