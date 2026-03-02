# Land Update Supervisor (Idle-Aware Restarts)

## Summary

Add a dedicated Node process (`land-supervisor`) that runs the land process as a child, checks for git updates, and applies them only when the land is least busy.

This keeps update logic out of channel code and gives us one place to manage restart policy.

## Current State

- `silaland run` starts `Land` directly from `packages/land/src/cli.js`.
- `Land` starts channel runtimes (`SlackChannel`, `TelegramChannel`) in-process.
- Each channel already serializes work per thread (`#processingThreads` map + `enqueueSerialTask`).
- Channel runtimes can stop cleanly (`channel.stop()`), but `Land` does not expose a full stop/drain API yet.
- There is no built-in update checker, fetcher, or restart scheduler.

## Problem

If we update the repo and restart immediately, we can interrupt active conversations and tool runs.
We need automatic updates with a simple and explainable "restart when least busy" rule.

## Goals

- Auto-check and fetch updates from a configured git remote/branch.
- Restart only when runtime load is low.
- Keep architecture simple: one supervisor process and one land worker process.
- Avoid adding external infra (no Redis, no extra services).
- Keep behavior deterministic and observable from logs/files.

## Non-Goals

- Zero-downtime rolling deployments.
- Multi-host orchestration.
- Auto-merging non-fast-forward branches.
- Full canary or blue/green rollout in v1.

## Proposed Design

### 1) Process Model

Run a new command:

```bash
node packages/land/src/cli.js supervise <land-path>
```

Supervisor responsibilities:

- spawn a child worker process that runs the land
- poll git for upstream changes
- decide when restart is allowed
- perform update + restart sequence
- persist update status for debugging

Worker responsibilities:

- run current `Land` runtime
- report current load snapshot to supervisor over IPC
- accept drain/stop commands from supervisor

### 2) Load Signal (Least Busy)

Define land as busy when any of these are true:

- any channel has `activeThreads > 0`
- `now - lastActivityAt < quietPeriodMs`

`least busy` for restart means:

- `activeThreads === 0`
- quiet period reached (default 120s)
- optional maintenance window check passes (for example 02:00-05:00 local server time)

Implementation detail:

- add `getStatus()` on each channel runtime
- aggregate in `Land.getStatus()`
- include at least: `activeThreads`, `lastActivityAt`, `channelCount`, `isRunning`

### 3) Update Detection

Every `checkIntervalMs` (default 5 minutes):

- skip if repo has local uncommitted changes (`git status --porcelain` not empty)
- `git fetch --prune <remote>`
- compare `HEAD` with `<remote>/<branch>`
- if behind, mark `pendingUpdate = targetCommit`

Only fast-forward updates are allowed in v1.

### 4) Apply Sequence

When `pendingUpdate` exists and load policy allows restart:

1. Ask worker to enter `drain` mode.
2. Wait until worker reports idle or `drainTimeoutMs` expires.
3. Stop worker gracefully (`SIGTERM`, then `SIGKILL` fallback).
4. Apply update:
   - `git pull --ff-only <remote> <branch>`
   - run `npm ci --workspaces --include-workspace-root` only if lockfile/package manifests changed
5. Start worker again.
6. Run a startup health check (worker must report `isRunning=true` within timeout).

If update fails, keep previous runtime state file with error details and continue retry loop with backoff.

## Configuration

Store defaults in `land/config.json` under a new block:

```json
{
  "updates": {
    "enabled": true,
    "remote": "origin",
    "branch": "main",
    "checkIntervalMs": 300000,
    "quietPeriodMs": 120000,
    "drainTimeoutMs": 180000,
    "maintenanceWindow": "02:00-05:00",
    "requireCleanWorktree": true
  }
}
```

CLI flags can override these for one run.

## Observability

Write `land/.runtime/update-state.json`:

- current commit
- pending commit
- last check time
- last update attempt
- last update result
- last restart reason

Log key events:

- update detected
- postponed due to busy runtime
- drain started/completed/timed out
- update applied
- worker restart success/failure

## Implementation Plan

1. Add `supervise` command in `packages/land/src/cli.js`.
2. Add `packages/land/src/supervisor.js` for process + git orchestration.
3. Add worker IPC entrypoint (`packages/land/src/worker.js`).
4. Add `Land.stop()` and `Land.getStatus()` in `packages/land/src/land.js`.
5. Add `getStatus()` and `setDrainMode()` hooks in Slack and Telegram channels.
6. Add update config parsing/validation in `packages/land/src/config.js`.
7. Add docs for running supervised mode in `docs/land.md`.

## Test Plan

- Unit tests for update policy decisions (idle/busy/window checks).
- Unit tests for git state parsing (up-to-date, behind, dirty worktree).
- Unit tests for supervisor state machine (pending, draining, applying, restarting).
- Integration test with fake worker IPC to verify "postpone while busy, restart when idle".
- Integration test proving no restart while `activeThreads > 0`.
- Integration test proving failed update does not crash supervisor loop.

## Risks and Mitigations

- Risk: drain never reaches idle.
  - Mitigation: `drainTimeoutMs` + forced restart policy with explicit logs.
- Risk: dirty worktree blocks updates forever.
  - Mitigation: visible status in `update-state.json` and log warning each cycle.
- Risk: restart loop after bad upstream commit.
  - Mitigation: capped retries and cooldown before next attempt.

## Open Questions

- Should we allow forced restart after long deferral (for example 24h), even if never idle?
- Should maintenance window be required in production or optional?
- Do we want to send an admin channel message when an update is applied or blocked?
