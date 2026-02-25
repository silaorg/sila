# Proposal: Agent support for Google Sheets and Google Docs

## Summary

We can add Google Workspace support by introducing a small connector layer between thread agents and Google APIs.
The first version should support reading and writing Docs and Sheets in a safe, auditable way.
The key idea is to keep our existing architecture: the gateway owns external API integration, agents request actions through a clear contract, and thread logs record what happened.

## Why this matters

Teams store a lot of operational data in Google Sheets and process docs in Google Docs.
If agents can work with those sources directly, they can automate common workflows like status reports, data cleanup, structured updates, and content drafting.

## Scope for v1

Support these operations first:

- list accessible docs and sheets for the authorized workspace
- read doc content
- append and replace doc content in explicit ranges
- read sheet metadata
- read sheet ranges
- write values to sheet ranges
- append rows to a sheet

Out of scope for v1:

- advanced formatting and charts
- pivot table creation
- complex permission management
- real time collaborative conflict resolution

## High level architecture

1. Add a Google Workspace provider module under the gateway layer.
2. Add agent tool actions for docs and sheets that call gateway APIs, not Google APIs directly.
3. Persist all inbound tool requests and outbound results into thread event logs.
4. Keep one shared action contract for all channels so Slack and Telegram agents can use the same tools.

This keeps the system simple and aligned with the current direction where the gateway talks to external providers and agents focus on reasoning and workflow.

## What it takes

### 1) Google Cloud setup

- create a Google Cloud project for Silaland integrations
- enable Google Docs API and Google Sheets API
- configure OAuth consent screen
- create OAuth client credentials (web and possibly desktop style for admin setup)
- define required scopes

Recommended initial scopes:

- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive.readonly`

Notes:

- We should start with the smallest set that supports v1.
- Drive read scope helps with file discovery and metadata.

### 2) Workspace auth and token storage

Implement an auth flow for each workspace/admin:

- admin connects Google account once
- gateway receives OAuth code and exchanges for access/refresh tokens
- refresh token is encrypted at rest
- token metadata stored per workspace in provider config

Required implementation details:

- encrypted secret storage for refresh tokens
- automatic access token refresh
- clear revocation handling
- permission error mapping to user-friendly agent messages

### 3) Gateway provider module

Add a provider module, for example `google-workspace-provider`, with small methods:

- `listFiles({ workspaceId, query })`
- `readDoc({ workspaceId, documentId })`
- `updateDoc({ workspaceId, documentId, requests })`
- `readSheet({ workspaceId, spreadsheetId, range })`
- `updateSheet({ workspaceId, spreadsheetId, range, values })`
- `appendSheetRows({ workspaceId, spreadsheetId, range, values })`

The provider should:

- validate inputs
- execute Google API calls
- normalize outputs to internal JSON shapes
- return structured errors with stable error codes

### 4) Agent tool contract

Expose tools to agents through a narrow, explicit interface:

- `google_docs_read`
- `google_docs_update`
- `google_sheets_read`
- `google_sheets_update`
- `google_sheets_append_rows`

Each tool call should include:

- workspace id
- target file id
- range or document operation payload
- optional idempotency key

Each tool result should include:

- status
- normalized payload
- error code and message when failed

### 5) Safety and policy controls

Before executing writes, enforce policy checks:

- workspace level allowlist for file ids or folders
- optional read only mode by workspace
- per-agent capability flags
- maximum rows/cells/chars per operation
- write confirmation mode for risky bulk operations

Also add audit fields in thread logs:

- who requested action (agent/user)
- what target was touched
- before/after summary where possible
- API outcome

### 6) Data modeling and event logging

For each Google tool action, append events in thread logs:

- `tool_call_requested`
- `tool_call_executed`
- `tool_call_failed`

Include:

- tool name
- input hash
- normalized response summary
- latency
- retry count

This keeps behavior replayable and easy to debug.

### 7) Error handling and retries

Implement predictable retry behavior:

- retry transient HTTP 429 and 5xx with bounded backoff
- do not retry 4xx auth/scope errors
- mark idempotent writes with operation ids

Map common failures to clear messages:

- token expired and refresh failed
- missing scope
- file not found or not shared
- protected range write denied
- quota limit reached

### 8) Developer and user UX

Add:

- workspace admin command or settings page to connect Google
- tool usage docs for prompts and agent profiles
- clear status checks like "Google connected" and "Scopes verified"

## Rollout plan

Phase 1

- implement auth connection flow
- implement read only tools for docs and sheets
- add logging and observability

Phase 2

- implement write tools with policy guardrails
- add idempotency and retry controls

Phase 3

- improve ergonomics with templates and higher level workflows
- optional support for formatting and richer document operations

## Testing strategy

- unit tests for input validation and output normalization
- integration tests against mocked Google APIs
- optional smoke test environment with a dedicated test workspace
- replay tests from thread logs to verify deterministic behavior

## Risks and mitigations

Risk: token security mistakes.
Mitigation: encrypted at-rest token storage, key rotation support, strict access boundaries.

Risk: agents making broad unintended edits.
Mitigation: capability flags, explicit file allowlists, operation size limits, confirmation mode.

Risk: quota exhaustion.
Mitigation: request batching, backoff, visibility into usage, workspace-level rate limits.

Risk: complicated API payloads leaking into prompts.
Mitigation: keep internal normalized schemas and hide raw API complexity from agents.

## Open questions

- Should we support service accounts for Google Workspace domains in v1 or only user OAuth?
- Do we need folder-scoped authorization UX at launch?
- Should write operations require explicit user confirmation by default?
- Where should workspace admins manage allowed documents and sheets?

## Estimated implementation effort

For an MVP with read and basic write support:

- auth flow and token lifecycle: 3 to 5 days
- provider module and normalized schemas: 3 to 4 days
- agent tool wiring and event logging: 2 to 3 days
- tests, docs, rollout hardening: 2 to 3 days

Rough total: 2 to 3 engineering weeks for one engineer, depending on existing gateway abstractions and admin UX readiness.
