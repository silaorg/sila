# Agent Runtime Path Anchors

## Summary

Inject explicit runtime path anchors so the agent always knows:

- land root (where channels, threads, assets live)
- current thread root (the active thread workspace)
- repo root (where source code lives)

Use environment variables as source of truth and append a managed runtime-path block to instructions.

## Problem

Today the agent gets generic environment guidance, but not concrete absolute paths for the current land and repository.
That makes source-code tasks less reliable because the agent may guess paths.

## Proposed Behavior

At runtime, provide these variables:

- `LAND_PATH` (required): absolute path to the running land root
- `THREAD_PATH` (set per message runtime): absolute path to current thread root
- `SOURCE_PATH` or `REPO_ROOT` (optional): absolute path to source repository root

Append this managed block to instructions:

```text
<environment_runtime_paths>
Land root (absolute): ...
Current thread root (absolute): ...
Source repo root (absolute): ... or [not set]
Default thread workspace: ./channels/<channel>/<thread-id>
Use source repo root for source-code edits.
Use current thread root for thread files and land root for channels/assets.
</environment_runtime_paths>
```

This block is additive and does not replace existing `<environment>` content.

## Resolution Rules

Resolve paths in this order:

1. `LAND_PATH`: always `path.resolve(landPath)` from runtime.
2. `THREAD_PATH`: from per-message runtime `threadDir` when available.
3. `SOURCE_PATH`/`REPO_ROOT`: env override if set, otherwise auto-detect from `LAND_PATH` upward by finding `.git`, otherwise unset.

When set, values should be normalized to absolute real paths.

## Wiring Plan

1. Add `packages/silaland/src/runtime-paths.js` to resolve and validate runtime path context.
2. In `loadChannelInstructions(...)`, resolve runtime paths from `landPath` and optional `threadPath`.
3. Append a managed runtime-path instruction block generated from resolved paths.
4. Keep `@sila/agents` instruction APIs unchanged in v1; do injection in `packages/silaland` layer.

## Why this approach

- Minimal risk: no cross-package API changes needed in `@sila/agents`.
- Explicit control: deployments can pin `SOURCE_PATH`/`REPO_ROOT`.
- Good fallback: repo auto-detect works when env is not configured.

## Test Plan

- Unit: runtime path resolver (`env override`, `git detect`, `not found` cases).
- Unit: instruction assembly includes runtime path block with expected values.
- Integration: Slack/Telegram runtime loads block and preserves existing defaults/custom instruction files.
