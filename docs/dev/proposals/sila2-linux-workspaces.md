# Sila 2: Linux-Powered Workspaces

## Summary
Sila 2 runs each workspace on Linux as a multi-user environment.  
Each user in a workspace has a real Linux user account and home directory, with access enforced by native Linux permissions.

`packages/desktop` and `packages/web` become thin shells that connect to a Linux-hosted workspace service (HTTP by default, SSH for bootstrap/admin/recovery).

## Goals
- Use Linux users, groups, and filesystem permissions as the primary security model.
- Keep desktop/web clients lightweight and mostly stateless.
- Support both manual setup and guided setup from the Sila app.

## V1 Constraints
- No local-first mode.
- Requires a Linux server reachable over network.
- Requires SSH for initial setup (at minimum).

## Setup Paths
1. Manual setup
- Admin provisions server, installs Sila workspace components, and configures users over SSH/CLI.

2. Guided setup in Sila app
- Admin enters SSH access details.
- Sila app bootstraps the workspace automatically.
- Admin then manages users and access through Sila UI.

## Proposed Architecture
1. Workspace Host (Linux)
- Linux accounts and groups per workspace.
- Workspace service (`sila-workspaced`) exposing API for health, users, and policy operations.

2. Sila App (Desktop/Web thin shell)
- Workspace and user-management UI.
- API calls over HTTPS to workspace service.
- SSH path for bootstrap and privileged maintenance actions.

3. Identity Mapping
- Sila identities map to Linux users on each workspace.
- Optional per-user SSH keys for direct shell access.

## Security Model
- Linux enforces process and file boundaries.
- Sila orchestrates provisioning and policy mapping, rather than re-implementing permissions.
- Audit events should capture user creation/removal, role/group changes, and key management actions.

## Tradeoffs
- Pros
- Strong, battle-tested permission model.
- Clear operational boundaries and easier debugging on host systems.

- Cons
- Remote-first only for V1.
- Needs Linux server operations and SSH knowledge.
- Distro/environment variance must be handled.

## Milestones
1. Define role-to-Linux-group mapping and workspace service API.
2. Implement SSH bootstrap flow for guided setup.
3. Add thin-shell admin workflows in `packages/desktop` and `packages/web`.
4. Ship V1 with manual setup fallback always available.

## Open Questions
- Single-host-only in V1, or early multi-node support?
- Which Linux distros are officially supported first?
- Is root required for bootstrap, or is sudo-only sufficient?
