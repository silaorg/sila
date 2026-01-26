# Proposal: Offline OAuth connections (Google Drive, Notion)

Status: Draft

## Goal
Allow users to connect Google Drive and Notion without running a Sila server.

## Summary
Use OAuth 2.0 native app flows (Authorization Code + PKCE) in the desktop app.
Store tokens locally as space secrets.
Add a provider-specific persistence layer to sync space ops when online.

## Non-goals
- Build a hosted backend for Sila.
- Guarantee real-time sync while offline.
- Implement every provider at once.

## User flow
1. User clicks “Connect Google Drive” (or Notion) in Space settings.
2. Sila opens the system browser to the provider consent page.
3. Provider redirects back to Sila.
4. Sila exchanges code for tokens and stores them as secrets.
5. Space starts syncing when online.

## OAuth flow options (no server)
Pick one per provider and platform:

Option A: Custom URL scheme
- Register `sila://oauth` in the Electron app.
- Use that redirect URI in the OAuth client.
- Parse the code from the callback and exchange for tokens.

Option B: Local loopback server
- Start a local HTTP server on `127.0.0.1` with a random port.
- Use `http://127.0.0.1:{port}/callback` as the redirect URI.
- Capture the code and exchange for tokens.

Option C: Device Authorization Flow (fallback)
- Show a code and verification URL to the user.
- Poll the provider until authorization completes.

## Token storage
- Store access/refresh tokens in space secrets (encrypted at rest).
- Keep only access tokens in memory.
- Refresh access tokens on demand.
- Allow disconnect to revoke and delete secrets.

## Architecture impact
- Add a generic OAuth helper in desktop package.
- Add per-provider “connector” modules that:
  - define OAuth client config
  - provide token refresh logic
  - map API calls for sync
- Add a new persistence layer for remote ops sync.
- Extend URI mapping to use the new layer for `gdrive://` or `notion://`.

## Minimal MVP (Drive)
- Provider: Google Drive
- Sync: Space ops only (no file bytes)
- Storage: `space-v1/ops/` stored as JSONL files in Drive
- Conflict: rely on RepTree merge after download
- UI: connect, disconnect, sync status

## Notion scope (phase 2)
- Treat as content integration, not a full space backend.
- Provide import/export of documents or a “Notion mirror” app tree.

## Risks
- OAuth UX complexity on Windows and Linux.
- Token revocation and expired refresh tokens.
- API quotas and rate limits.

## Success criteria
- User can connect Drive on desktop without any server.
- Tokens persist across app restarts.
- Space loads offline and syncs when online.

## Next steps
1. Pick OAuth callback strategy per platform.
2. Implement desktop OAuth helper and token storage.
3. Implement `GoogleDrivePersistenceLayer`.
4. Add basic UI for connect/disconnect and sync status.
