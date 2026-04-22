# Proposal: Dashboard v2 Multi-Org Model (Better Auth + Convex + Org File Systems)

Status: Draft

## Goal
Ship a simple B2B dashboard with:
- user accounts
- organization creation
- member invitations
- role-based membership
- organization-scoped storage for files, agents, and simulations

Use this split:
- **Better Auth + Convex** for identity and organization control-plane data
- **Server file system** for organization-generated artifacts (files, agent assets, simulations)

## Why this split

### Control plane (Convex)
Use Convex for small, relational metadata and permissions:
- users
- organizations
- memberships
- invitations
- audit logs

This keeps account/org workflows simple and centralized.

### Data plane (file system)
Store large and frequently changing org artifacts as files on disk:
- uploaded files
- simulation specs and outputs
- agent-generated artifacts

This matches how Sila already stores files in local/space layouts and keeps version 1 operationally simple.

## Existing storage pattern we reuse
Current Sila storage already separates metadata from disk artifacts and uses:
- content-addressed immutable files (`static/sha256`)
- mutable blobs (`var/uuid`)

For Dashboard v2 we apply the same idea at **organization** scope.

## Organization file-system layout (MVP)

Storage root on server:

```
packages/server/data/orgs/{orgId}/
```

Layout:

```
packages/server/data/orgs/{orgId}/
  org.json                         # lightweight org-local metadata cache
  files/
    static/sha256/
      <hash[0..1]>/<hash[2..]>
    var/uuid/
      <uuid[0..1]>/<uuid[2..]>
  agents/
    {agentId}/
      manifest.json
      runs/
        {runId}/
          input.json
          output.json
          logs.txt
          artifacts/
  simulations/
    {simulationId}/
      simulation.json              # spec/config
      runs/
        {runId}/
          status.json
          events.jsonl
          outputs/
```

Notes:
- Every org has a separate root directory.
- No cross-org shared writable paths.
- S3 sync is a future layer; not in MVP.

## What goes to Convex vs file system

### Convex (source of truth for access and indexing)
- `users`
- `organizations`
- `memberships` (`userId`, `organizationId`, `role`, `status`)
- `invitations` (`organizationId`, `email`, `role`, `tokenHash`, `expiresAt`)
- `artifactIndex` (metadata only: orgId, kind, storageType, storageKey, name, size, mimeType, createdBy)
- `auditLogs`

### File system (source of truth for payloads)
- raw file bytes
- simulation definitions and run outputs
- agent run artifacts and logs
- mutable working files

## Authorization model

### Roles
- `owner`
- `admin`
- `member`

### Policy baseline
- `member`: read/write org files, run simulations/agents
- `admin`: member + invite/remove members + update member roles
- `owner`: admin + transfer ownership + delete org

### Required guard for every endpoint/function
1. Authenticate user (Better Auth session).
2. Resolve active `organizationId`.
3. Verify membership in Convex.
4. Verify role for action.
5. Build file paths only from validated `organizationId` and generated IDs.

## API surface (MVP)

### Auth and org control plane (Convex-backed)
- `auth.signUp`
- `auth.signIn`
- `auth.signOut`
- `users.me`
- `orgs.create`
- `orgs.listMine`
- `orgs.get`
- `orgs.inviteMember`
- `orgs.acceptInvitation`
- `orgs.updateMemberRole`
- `orgs.removeMember`

### Artifact/file endpoints (server FS-backed)
- `orgFiles.list(orgId, path?)`
- `orgFiles.upload(orgId)`
- `orgFiles.delete(orgId, id)`
- `simulations.create(orgId, spec)`
- `simulations.get(orgId, simulationId)`
- `simulations.run(orgId, simulationId)`
- `simulations.getRun(orgId, simulationId, runId)`
- `agents.run(orgId, agentId, input)`
- `agents.getRun(orgId, agentId, runId)`

## UI scope (MVP)
1. Sign in / sign up pages
2. Organization switcher
3. Create organization modal
4. Invite member modal
5. Members management page
6. Org files page
7. Org simulations page
8. Agent runs page (minimal list + status)

## Implementation details for org file systems

### Path rules
- Root path is derived only from trusted org ID:
  - `packages/server/data/orgs/{orgId}`
- Reject path traversal (`..`, absolute paths, mixed separators).
- IDs are generated server-side.

### Indexing strategy
- Store bytes on disk.
- Store lookup metadata in Convex (`artifactIndex`).
- Reconcile index on startup with a lightweight verifier job.

### Deletion strategy
- Soft-delete metadata first in Convex.
- Async delete files on disk.
- Keep tombstone logs in `auditLogs`.

## Delivery plan

### Phase 0 — foundation (2–3 days)
- Add Convex schema for auth/org/membership/invites.
- Integrate Better Auth with Convex-backed session flow.
- Add org context middleware.

### Phase 1 — org directories and files (3–4 days)
- Implement `packages/server/data/orgs/{orgId}` layout.
- Add upload/list/delete for org files.
- Add `artifactIndex` records and access checks.

### Phase 2 — simulations and agents as files (3–5 days)
- Persist simulation specs/runs under `simulations/`.
- Persist agent run artifacts/logs under `agents/`.
- Add status APIs and dashboard pages.

### Phase 3 — hardening (2–3 days)
- Add audit logging for member and artifact actions.
- Add rate limits for auth/invite/upload endpoints.
- Add tests for cross-org isolation and path safety.

## Security checklist
- Hash invitation tokens and enforce expiry.
- Enforce org membership before any file-system operation.
- Never accept raw file-system path from clients.
- Validate file size and type limits.
- Ensure all org paths are sandboxed to org root.
- Log ownership changes and destructive actions.

## Migration and compatibility
- Keep existing local-first workspace model unchanged.
- Dashboard multi-org model is additive.
- Future bridge can map spaces to org roots:
  - `spaceId -> organizationId -> orgRootPath`

## Future extension (not MVP)
- Add optional background sync from org roots to S3-compatible object storage.
- Add restore/import job from object storage back to org roots.

## Decision
Proceed with:
- **Better Auth + Convex** for users/organizations/authz metadata.
- **Per-organization file systems** for files, simulations, and agent artifacts.
- **No S3 sync in v1** (filesystem only).
