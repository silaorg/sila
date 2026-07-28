# Google Workspace integration

Status: proposal.

## Goal

Let agents read and update Google Docs and Sheets through a small set of
workspace tools:

- find accessible documents and spreadsheets
- read document content and sheet ranges
- update explicit document or sheet ranges
- append rows to a sheet

Formatting, charts, pivots, and permission management are out of scope for the
first version.

## Design

Implement one Google Workspace tool package under `tools/`. Keep Google API
clients and token handling inside that package instead of adding Google logic
to the agent runtime or channel classes.

Expose a small action-based interface, such as:

- `find`
- `read-document`
- `update-document`
- `read-sheet`
- `update-sheet`
- `append-sheet-rows`

Each request names an exact document or spreadsheet. Write requests include an
idempotency key and explicit range or operation. Responses use compact,
normalized data instead of raw Google API payloads.

## Authentication

Authentication must work for Slack, Telegram, and app threads, so it cannot
depend only on a browser session. Start with workspace-level credentials owned
by the server. Store refresh tokens in the deployment's secret store, not in
thread logs or agent-visible files.

User-delegated OAuth can be added later if the product needs each app user to
act as their own Google identity. That requires a clear account-linking and
token-ownership model before implementation.

Use the narrowest practical scopes. Read-only access should be independently
configurable from write access.

## Safety

- Allowlist accessible Drive folders or file IDs.
- Bound cells, rows, characters, response bytes, and request duration.
- Retry only rate limits and transient server failures with bounded backoff.
- Require explicit targets for writes and reject ambiguous ranges.
- Return stable error codes for authentication, permission, quota, validation,
  and provider failures.
- Keep secrets and full document contents out of operational logs.

Normal agent message persistence already records tool activity in the thread's
append-only event log. The tool should return a concise change summary so
history stays useful without duplicating entire documents.

## Open decision

Choose the first credential model before implementation:

1. Workspace OAuth account, suitable for a shared team identity.
2. Google Workspace service account with domain-wide delegation, suitable for
   managed enterprise domains.

Do not build both in the first version.
