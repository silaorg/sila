# Agent Runtime Path Anchors

## Summary

Inject explicit runtime path anchors so the agent always knows:

- land root (where channels, threads, assets live)
- repo root (where source code lives)
- optional project root (for multi-project lands)

Use environment variables as source of truth and append a managed runtime-path block to instructions.

## Problem

Today the agent gets generic environment guidance, but not concrete absolute paths for the current land and repository.
That makes source-code tasks less reliable because the agent may guess paths.

## Proposed Behavior

At runtime, provide these variables:

- `LAND_PATH` (required): absolute path to the running land root
- `REPO_ROOT` (optional): absolute path to main repository root
- `PROJECT_ROOT` (optional): absolute path to active project root

Append this managed block to instructions:

```text
<environment_runtime_paths>
Land root (absolute): ...
Repo root (absolute): ... or [not set]
Project root (absolute): ... or [not set]
Default thread workspace: ./channels/<channel>/<thread-id>
Use repo root for source-code edits and land root for channel/thread/assets data.
</environment_runtime_paths>
```

This block is additive and does not replace existing `<environment>` content.

## Resolution Rules

Resolve paths in this order:

1. `LAND_PATH`: always `path.resolve(landPath)` from runtime.
2. `REPO_ROOT`: `process.env.REPO_ROOT` if set, otherwise auto-detect from `LAND_PATH` upward (`.git` or `git rev-parse --show-toplevel`), otherwise unset.
3. `PROJECT_ROOT`: `process.env.PROJECT_ROOT` if set, otherwise unset.

When set, values should be normalized to absolute real paths.

## Wiring Plan

1. Add `packages/land/src/runtime-paths.js` to resolve and validate runtime path context.
2. In `Land.run()`, resolve once and store in process env (`LAND_PATH`, `REPO_ROOT`, `PROJECT_ROOT` when available).
3. In `loadChannelInstructions(...)`, append a managed runtime-path instruction block generated from resolved paths.
4. Keep `@sila/agents` instruction APIs unchanged in v1; do injection in `packages/land` layer.

## Why this approach

- Minimal risk: no cross-package API changes needed in `@sila/agents`.
- Explicit control: deployments can pin `REPO_ROOT`/`PROJECT_ROOT`.
- Good fallback: repo auto-detect works when env is not configured.

## Test Plan

- Unit: runtime path resolver (`env override`, `git detect`, `not found` cases).
- Unit: instruction assembly includes runtime path block with expected values.
- Integration: Slack/Telegram runtime loads block and preserves existing defaults/custom instruction files.
