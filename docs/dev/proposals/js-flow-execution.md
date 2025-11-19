# Proposal: Executable JS Flow Files in Workspaces

## Problem Statement
- Users want to script repeatable workflows (for example, `generateVideo.flow.js`) directly inside a workspace.
- Agents already create and edit files, but they cannot lint or run them, which prevents automation loops such as “write → lint → execute → inspect outputs.”
- We need an incremental path that keeps Sila’s local-first, user-owned guarantees while adding safe execution of JavaScript workflow files.

## Current Context
- **Workspaces are ordinary folders** that users sync/share however they like; anything we introduce must stay sandboxed inside that folder and respect offline operation.  
- **Files are modeled via RepTree metadata + CAS/mutable blobs** (`Files AppTree`, hashes for immutable binaries, UUIDs for editable docs). Workflow scripts would just be regular text files that agents manage with the existing `ls`, `mkdir`, `move`, `apply_patch`, and `write_to_file` tools.  
- **`WrapChatAgent` already attaches tools per conversation** by injecting a workspace-aware fetch and exposing FS tools through `AgentServices.getToolsForModel`. Extending the toolbelt with “lint” and “run” commands follows the same pattern.

## Goals
1. Allow agents (and users) to lint and execute `.flow.js` files stored in the current workspace.  
2. Keep everything local-first, with no dependence on remote services beyond the model provider already in use.  
3. Provide clear logs/results back into the chat, ideally attaching artifacts (stdout/stderr, generated files) to the Files tree.  
4. Offer a straightforward migration path: start simple, layer in ergonomics/sandboxing as needed.

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

### 1. Direct Node Runner Tool
- **What:** Add `lint_js` and `run_js` LangTools. They resolve workspace-relative paths (reuse `toolLs` guards), then spawn the Node runtime/ESLint already bundled with the desktop build.  
- **Flow:** `apply_patch` → `lint_js { path, fix }` → `run_js { path, args }`; stdout/stderr streams back and is optionally saved as `flows/.runs/<timestamp>.log`.  
- **Implementation Notes:**  
  - Leverage `child_process.spawn` with `cwd` set to the workspace root, pass explicit env, enforce timeouts, strip ANSI codes before sending to chat.  
  - Allow dependency installs by pointing `npm`/`pnpm` to a `flows/node_modules` directory inside the workspace.  
  - Add toggles for network access (default deny) and memory/CPU caps using Node’s `--max-old-space-size` and process kill timers.  
- **Pros:** Fastest to ship, minimal new concepts, uses existing runtime.  
- **Cons:** Harder to sandbox, relies on developers managing ESLint configs, dependency installs may mutate the workspace a lot.

### 2. Flow Manifest + Worker Thread
- **What:** Standardize `flows/flow.config.json` (name → entry → env → permissions). A new Flow Runner worker in the desktop process watches the folder. Tools `flow_run`, `flow_list`, `flow_status` enqueue requests to the worker, which lints (via `npm run lint:flow -- <entry>`) then executes `node flows/<entry>`.  
- **Flow:** Agents reference flows by name (`flow_run { name: "generateVideo", mode: "dry-run" }`). The worker captures logs, exit codes, produced file refs, and writes a CRDT vertex per run.  
- **Implementation Notes:**  
  - Schema validate manifests (Zod) so bad configs fail early.  
  - Worker thread isolates execution and keeps the UI responsive; all outputs go through a structured channel.  
  - Attach run metadata under `files/runs/<flow>/<timestamp>.json` for later inspection.  
- **Pros:** Gives users first-class “flows” with reusable metadata, centralizes execution control, easier to add scheduling later.  
- **Cons:** Requires more scaffolding (manifest format, watcher, queue) before first run works.

### 3. Sandboxed Deno/Bun Execution
- **What:** Bundle a self-contained runtime (Deno or Bun) and expose a single `flow_exec` tool that performs `deno lint` + `deno run` with explicit permission flags (e.g., `--allow-read=/workspace/<id>/flows`, `--deny-net` by default). Each call happens in a temp dir, dependencies are cached per workspace.  
- **Flow:** Agent writes `*.flow.js`, optionally annotates permissions at the top (`// @flow net:off fs:read`), runs `flow_exec { path, lint: true, args }`, and receives structured diagnostics plus stdout/stderr.  
- **Implementation Notes:**  
  - Deno already ships lint/test/type-check, so the tool can parse JSON diagnostics and pass precise file/line info back to the agent.  
  - Sandboxing is handled by the runtime (no custom chroot).  
  - Network/file permissions can be escalated per run via tool arguments or manifest comments.  
- **Pros:** Strong isolation, minimal extra tooling to maintain, deterministic dependency cache.  
- **Cons:** Adds another binary to ship, increases bundle size, unfamiliar workflow for users tied to Node tooling.

## Recommendation / Next Steps
1. **Spike the Direct Node Runner** (fastest path to end-to-end value). Build it as a LangTool pair with strict timeouts and workspace path validation.  
2. **Evaluate user friction** (config management, sandboxing). If flows proliferate, graduate to the Manifest + Worker model so runs are first-class artifacts.  
3. **Plan for sandboxing** by optionally swapping the backend to Deno/Bun later without changing the tool contract—keep arguments generic (`{ path, args, env, allowNet }`) so the runtime is an implementation detail.

This sequence gives us immediate workflow automation while leaving room to harden the system and add richer flow metadata without redoing the agent interface.
