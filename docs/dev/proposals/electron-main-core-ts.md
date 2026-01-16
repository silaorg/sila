# Proposal: Use @sila/core in Electron main + TypeScript main build

## Goal

Allow Electron main to use `@sila/core`, and write main process code in TypeScript.

## Why

- Run heavy search/indexing in main without renderer memory pressure.
- Share core logic between renderer and main.
- Improve main-process maintainability with TS.

## Scope

- Electron main process only.
- No change to renderer build pipeline.

## Current state (summary)

- Main entry is `packages/desktop/src-electron/main-electron.js`.
- Electron main code is JS.
- Renderer builds the chat search index from `Space` data.

## Proposed changes

### 1) Add a TS build for Electron main

- Create `packages/desktop/tsconfig.electron.json`.
- Add a build step to compile `src-electron/*.ts` → `dist-electron`.
- Update `packages/desktop/package.json`:
  - `main` → `dist-electron/main-electron.js`.
  - Add `build:electron` script.
  - Update `dev:electron` to run compiled output or use a TS runner (ts-node/tsx) in dev.
- Update Electron Builder `build.files` to include `dist-electron/**`.

### 2) Move main code to TS

- Rename `packages/desktop/src-electron/*.js` → `*.ts`.
- Convert CommonJS patterns to ESM where needed (repo is already `"type": "module"`).
- Fix import paths for `.js` output.

### 3) Enable `@sila/core` usage in main

Approach: main opens the workspace via core using the workspace path already tracked in `spaceManager`.

- Add a core-backed "space registry" in main:
  - On `register-space`, also store a `Space` instance keyed by spaceId.
  - Use the same persistence layers as renderer (FileSystem + AppTree loader).
- Expose minimal IPC to query core state from main (e.g., search index build, metadata).

### 4) Chat search indexing in main (follow-up)

- Move `buildChatSearchEntries` into a shared module usable by main.
- Main builds and persists the index; renderer only queries results via IPC.

## Migration steps

1) Add TS build pipeline and compile main to `dist-electron`.
2) Convert `src-electron` files to TS.
3) Wire core space loading in main:
   - Reuse `spaceManager` space path.
   - Instantiate `Space` in main for selected workflows.
4) Migrate search indexing to main.

## Risks

- Main process performance if heavy core operations run on the main thread.
- Core persistence behavior may differ between renderer and main; must ensure consistent file access.
- Build pipeline changes may affect Electron packaging if `dist-electron` is missing.

## Open questions

- Do we keep renderer `Space` instances, or move all read-only data access to main?
- Do we need a background worker for CPU-heavy tasks in main?
- Should we keep a single shared module for chat search to avoid drift?

## Success criteria

- Electron main runs compiled TS output.
- Main can open a workspace with `@sila/core` and read app trees.
- Chat search indexing can be executed in main (renderer only consumes results).
