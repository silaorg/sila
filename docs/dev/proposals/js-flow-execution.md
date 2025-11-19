# Proposal: Executable JS Flow Files in Workspaces

## Problem Statement
- Users want to script repeatable workflows (for example, `generateVideo.flow.js`) directly inside a workspace.
- Agents already create and edit files, but they cannot lint or run them, which prevents automation loops such as “write → lint → execute → inspect outputs.”
- We need an incremental path that keeps Sila’s local-first, user-owned guarantees while adding safe execution of JavaScript workflow files.

## Current Context
- **RepTree-backed virtual file system**: Every workspace is modeled as a set of RepTree CRDT trees (space tree + app trees). Files live in the Files AppTree with metadata pointing to CAS/mutable blobs in FileStore, so workflows must read/write via this virtual FS, not the host filesystem.  
- **Browser-first runtime**: The entire Sila client runs in a browser environment (Svelte + RepTree), even inside Electron. Execution tooling therefore needs to rely on browser APIs (Web Workers, WASM, message channels) for v1, while keeping hooks open to offload runs to Electron main or future servers.  
- **Existing agent tooling**: `WrapChatAgent` already wires tools (ls/mkdir/move/apply_patch/write) through `AgentServices.getToolsForModel`, with workspace-aware fetch access to RepTree/AppTree data. New lint/run tools can reuse that plumbing.

## Goals
1. Allow agents (and users) to lint and execute `.flow.js` files stored in the current workspace.  
2. Keep everything local-first and browser-native for v1 (Web Worker/WASM execution) while preserving the option to delegate to Electron main or remote servers later without changing the tool contract.  
3. Provide clear logs/results back into the chat, ideally attaching artifacts (stdout/stderr, generated files) to the Files tree.  
4. Offer a straightforward migration path: start simple, layer in ergonomics/sandboxing or remote execution as needed.

## Non-Goals
- Designing a general-purpose package manager or dependency cache (reuse what Node/Deno already provide).
- Running arbitrary binaries outside the workspace tree.
- Introducing long-lived background workers or schedulers (can be follow-up work).

## Success Criteria
- From chat, an agent can:  
  1. create `flows/generateVideo.flow.js`,  
  2. call a lint tool that reports actionable diagnostics, and  
  3. call a run tool that executes the script with bounded resources and surfaces results.  
- Execution never leaves the workspace boundaries unless the user explicitly allows outbound network.  
- Failure modes (missing file, lint errors, runtime exceptions) are surfaced in a structured way so the agent can act on them.

## Three Minimal Approaches

### 1. Browser Worker Runner (QuickJS/SES)
- **What:** Add `lint_flow` and `run_flow` LangTools that execute inside a dedicated Web Worker. Bundle a sandboxed JS engine (QuickJS compiled to WASM or SES Hardened Realms) plus WASM builds of ESLint/Babel. Tools resolve RepTree paths, load the script bytes via FileStore, stream them into the worker, and run them entirely via browser APIs.  
- **Flow:** `apply_patch` → `lint_flow { path, fix }` → `run_flow { path, args }`; stdout/stderr are captured via worker `postMessage` and optionally persisted as `files/flows/.runs/<timestamp>.log`.  
- **Implementation Notes:**  
  - Provide a constrained runtime API (read/write through RepTree-backed adapters, fetch proxy, timers) passed into the worker.  
  - Use WASM ESLint with a lightweight config (ships with the app) so linting works offline with no Node.  
  - Enforce CPU/time quotas via worker termination and limit memory via WASM heap size.  
- **Pros:** Works identically in browser, Electron, and future web builds; no native dependencies.  
- **Cons:** Need to maintain sandbox VM bundle; performance limited by WASM interpreter; harder to reuse existing Node-based tooling.

### 2. Flow Manifest + Worker Supervisor
- **What:** Introduce `flows/flow.config.json` describing named flows (entry vertex IDs, required permissions, default args). A browser worker supervisor watches (via RepTree observers) for manifest or script changes. Tools `flow_run`, `flow_list`, `flow_status` communicate with the supervisor, which handles lint + run inside the same worker sandbox as Approach 1 but uses the manifest metadata to configure env/permissions.  
- **Flow:** Agent calls `flow_run { name: "generateVideo", mode: "dry-run" }`; supervisor resolves the entry script, lints, executes, streams logs, and records run artifacts/metadata under `files/runs/<flow>/<timestamp>.json`.  
- **Implementation Notes:**  
  - Validate manifests with Zod before saving; errors surface to the chat immediately.  
  - Supervisor serializes run queue requests so only one flow runs per worker, keeping resource use predictable.  
  - Run metadata (status, duration, outputs) is mirrored back into RepTree so other UIs can display history.  
- **Pros:** Gives users first-class flows, centralizes permissions/env, and keeps the browser runtime responsive.  
- **Cons:** Requires manifest schema, observer wiring, and run queue before first execution, so slightly longer to ship.

### 3. Pluggable Remote/Electron Backend
- **What:** Define the lint/run tool contract so it can delegate to alternative executors: Electron main, a local Node service, or a remote workspace server. The browser still issues `flow_exec` requests, but the execution target is decided by policy (browser worker by default; optional backend for heavier workloads).  
- **Flow:** In v1, requests fall back to the browser worker. Later, users can opt into “server-backed” flows; the client serializes the needed files (hash references) and sends them to the backend, which runs the script (maybe using Node/Deno) and streams logs back through the same tool API.  
- **Implementation Notes:**  
  - Keep tool arguments runtime-agnostic (`{ path, args, env, allowNet }`) so the executor can be swapped without chat changes.  
  - For Electron, use IPC to call the main process; for remote servers, reuse the existing sync channel or add a lightweight HTTP runner.  
  - When remote, enforce access control and map run artifacts back into RepTree to keep the virtual FS authoritative.  
- **Pros:** Future-proofs the design for heavier flows and server/cloud execution while keeping the browser-first story intact.  
- **Cons:** Requires additional plumbing (IPC/transport, auth, serialization) when we introduce non-browser executors.

## Recommendation / Next Steps
1. **Spike the Browser Worker Runner**: bundle QuickJS/SES + WASM ESLint, expose `lint_flow`/`run_flow`, and validate RepTree path resolution + log capture end to end.  
2. **Layer Flow Manifest ergonomics** once basic execution works, so flows become named assets with reproducible configs and run history.  
3. **Design the pluggable executor interface** early (even if only the browser worker is implemented) so migrating select workspaces to Electron-main or future server backends is just a configuration change, not a protocol rewrite.

This keeps v1 purely browser-based, honors the RepTree virtual FS model, and leaves a straightforward path to heavier server/Electron execution when we need it.
