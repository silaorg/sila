# September 29 cleanup pass

Applied the critical-review and tidy actions to Heswe's Neorest integration
and the related Neorest client lifecycle code. Product flows and request
timeouts stay the same.

## What changed

- Neorest had two ways to install WebSocket handlers. Replacing a callback
  after connecting bypassed stale-socket checks. Handlers are now installed
  once per socket and read the current callbacks. A regression test confirms
  events from an old socket cannot affect its replacement.
- Subscription keys lived in a plain object. A route named `constructor`
  collided with an inherited property and was wrongly rejected as a duplicate.
  A `Map` now owns subscription callbacks, with regression coverage.
- Initial subscriptions and reconnects duplicated the same acknowledgment
  logic. They now share one request helper. Removed the forwarding-only
  subscription method, duplicate callback initialization, and stale comment.
- Heswe's event module imported types from the HTTP module that constructed it.
  Live-event types, connection setup, and lifecycle now live together in
  `workspace-events.ts`; the HTTP module handles HTTP only.
- Failed setup and component cleanup separately closed the same event client.
  One idempotent stop function now handles both and suppresses late callbacks.
  The existing failure test verifies cleanup happens once.

## Validation

- Neorest: 57 tests pass, including native HTTP/3 and the two new regression cases.
- Heswe: 218 tests pass; both frontend checks have zero errors and warnings.
- Production build passes with the existing dependency and bundle warnings.

## What still needs a separate review

Neorest's automatic upgrade/fallback and client reconnect logic still share
lifecycle responsibilities through several flags. A broader rewrite would be
harder to review than this cleanup. The smallest useful next step is to specify
one connection-attempt lifecycle and test cancellation during upgrade before
consolidating its ownership.

Heswe still uses a process-global slot to pass initialized Neorest handlers from
SvelteKit's bundle to the Node host. That bridge serves a real build boundary,
but initialization and shutdown ownership are split. The first step toward
simplifying it is host start/stop/reload contract coverage, then one runtime
owner shared by development and production hosts.
