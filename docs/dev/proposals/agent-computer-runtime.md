# Proposal: Workspace Computers for Heswe Agents

Status: Draft  
Audience: Heswe developers  
Scope: Hosted Heswe first, with self-hosted and multi-provider execution as a design requirement

## Summary

Heswe should separate an agent's reasoning process from the Linux environment where it uses files, commands, tools, and a browser.

A logical agent should not own a permanently running process or virtual machine. Instead:

- The **Agent Service** runs the model loop, loads agent instructions and conversation state, enforces policy, and decides which tools to call.
- A **workspace computer** provides an isolated Linux filesystem, shell, processes, workspace tools, and an optional browser.
- A workspace computer starts when work requires it, remains available while useful, and stops when idle.
- The Agent Service connects to the computer through a provider-neutral protocol.
- The computer may run on a server we own, a rented server, AWS, Google Cloud, or another provider.

The core model is:

> The agent is the brain. The workspace computer is the machine it temporarily uses.

This direction preserves Heswe's portable workspace model while providing stronger isolation, lower idle cost, browser interaction, long-running jobs, and freedom from a particular cloud provider.

## Decision requested

Approve the following architectural direction:

1. Keep model calls and the agent loop outside the workspace sandbox.
2. Put all workspace-controlled executable behavior inside the sandbox.
3. Give each active workspace one leased workspace computer in the first implementation.
4. Access the computer through typed file, shell, process, browser, and workspace-tool APIs.
5. Treat containers, gVisor, Kata, Firecracker, bare metal, and cloud VMs as interchangeable execution implementations below the same API.
6. Start with one Linux host and a local workspace directory before adding distributed storage or cloud capacity.

This proposal does not choose every runtime, storage, or streaming technology. It defines the boundaries that should remain stable while those implementations evolve.

## Terminology

### Logical agent

Persistent agent configuration, instructions, skills, model settings, permissions, and related history. A logical agent can exist without any running process.

### Agent run

A temporary execution of the model loop for a message, event, timer, or task. Multiple logical agents can be handled by the same Agent Service process.

### Workspace

The durable Heswe directory containing conversations, files, instructions, skills, tools, configuration, and results.

### Workspace computer

An isolated Linux environment that mounts one workspace and exposes operating-system capabilities to the Agent Service. It can contain shell sessions, long-running processes, workspace-provided tool code, Chromium, and a virtual display.

### Execution node

A physical server or cloud VM capable of hosting workspace computers. Every execution node runs a trusted host daemon called `agentd`.

### `agentd`

The trusted daemon that registers an execution node, manages sandbox lifecycle, mounts workspace storage, applies resource policy, and connects active computers to the Heswe control plane.

### `heswe-computerd`

A small service that runs inside each workspace computer. It implements file, shell, process, browser, and workspace-tool operations. It is inside the sandbox boundary and must be treated as potentially exposed to untrusted workspace code.

## Goals

- Let agents use a normal Linux environment with existing CLI tools.
- Start with CLI-only operation and add a browser or graphical session only when needed.
- Let a user watch the agent's browser and temporarily take control.
- Release CPU and memory when a workspace is inactive.
- Preserve workspace files, thread history, browser profiles, and explicit long-running state across agent runs.
- Keep platform authentication and model-provider secrets outside workspace sandboxes.
- Isolate arbitrary shell commands and workspace-provided JavaScript tools from the public API and other users.
- Support servers we own as the base capacity and cloud machines as optional overflow.
- Keep the design usable for both hosted Heswe and self-hosted deployments.
- Reuse the current Heswe agent, workspace, thread, and client architecture where practical.

## Non-goals for the first implementation

- A globally distributed scheduler.
- Transparent live migration of a running workspace computer.
- Full memory snapshots as the default persistence mechanism.
- A full GNOME or KDE desktop.
- Multiple computers concurrently writing the same workspace.
- Strongly consistent multi-region workspace storage.
- Starting with Firecracker orchestration before the simpler container path works.
- Replacing all current workspace persistence in one change.

## Why the agent should run outside the computer

The Agent Service and workspace computer have different security, lifecycle, and scaling requirements.

The Agent Service should own:

- Language-model calls and provider routing.
- Agent instructions and model-loop orchestration.
- Platform-level policy and approvals.
- Billing and usage accounting.
- Conversation progress events.
- Retry and cancellation policy.
- Short-lived credentials for computer access.

The workspace computer should own:

- The mounted workspace filesystem.
- Shell and PTY sessions.
- Python, Node.js, Git, ffmpeg, and other CLI software.
- Long-running processes.
- Workspace-provided executable tools.
- Chromium and its profile.
- The virtual display and user interaction state.

This split has several advantages:

1. A pure chat request may eventually run without starting a computer.
2. Platform model-provider keys do not enter a workspace sandbox.
3. A browser or long-running process can survive the end of one model call.
4. The Agent Service can restart and reconnect to the same computer state.
5. A failed execution node can be replaced without changing the logical agent.
6. Many logical agents can share a small number of Agent Service processes.

## Trust boundary

Anything executable or controlled by a workspace must stay inside the workspace computer.

| Component | Shared Agent Service | Workspace computer |
|---|---:|---:|
| Model request | Yes | No |
| Agent reasoning loop | Yes | No |
| Platform provider credentials | Yes | No |
| Conversation orchestration | Yes | No |
| Shell and PTY | No | Yes |
| Workspace filesystem | Through an authorized API | Yes |
| Python, Node.js, Git, ffmpeg | No | Yes |
| Workspace-provided JavaScript | No | Yes |
| Document processing code | No | Yes |
| Browser process and profile | No | Yes |
| Virtual display | No | Yes |
| User keyboard and mouse input | Routed by the platform | Applied here |

A separate Node child process is useful for crash containment, but it is not a sufficient security boundary. The current `execute_command` tool, PTY manager, and dynamically imported workspace tools can execute arbitrary code with the permissions of their host process. In production, these components must run inside the workspace computer.

## Proposed architecture

```text
                                  CONTROL PLANE

User
  |
  v
Heswe web API and authentication
  |
  v
AppWorkspaceService / Agent Service
  |-- loads agent configuration and conversation state
  |-- calls language models
  |-- publishes progress
  |-- requests approvals
  |-- invokes remote computer tools
  |
  +-------------------------+
                            |
                            | Workspace Computer Protocol
                            v
                                  EXECUTION PLANE

Global placement service
  |
  +--> execution site: owned server
  |      |
  |      v
  |    agentd
  |      |
  |      v
  |    workspace sandbox
  |      |-- heswe-computerd
  |      |-- /workspace
  |      |-- shell and jobs
  |      |-- workspace tools
  |      |-- optional Chromium
  |      `-- optional viewer
  |
  +--> execution site: AWS
  |
  +--> execution site: Google Cloud
  |
  `--> execution site: another provider
```

### Stable boundary

The stable product boundary should be the Workspace Computer Protocol, not a cloud VM API and not a particular container runtime.

The Agent Service should ask for capabilities such as:

```text
ensure workspace computer
read or write a workspace file
execute a command
start or inspect a process
start a browser
invoke a workspace tool
create a user viewer session
transfer browser control
checkpoint or stop the computer
```

The implementation below that boundary can change independently.

## Workspace computer granularity

The first implementation should create one computer per active workspace, not one computer per thread and not one computer per model call.

```text
Workspace A
`-- Computer A
    |-- thread 1 shell session
    |-- thread 2 shell session
    |-- browser context
    `-- shared workspace files

Workspace B
`-- stopped
    `-- durable files and checkpoint only
```

This matches Heswe's current workspace model:

- Instructions, skills, tools, and assets are workspace-scoped.
- Threads can have separate shell sessions and browser contexts.
- One computer can preserve useful state between consecutive turns.
- A stopped workspace consumes storage but no dedicated CPU or RAM.

If Heswe later supports several independent agents within one workspace, the computer key can become `workspaceId + agentId`, or independent tasks can use workspace branches. That is not required initially.

## Workspace Computer Protocol

The Agent Service should not mount a remote workspace with NFS or SSHFS and then treat it like a local directory. It should use a typed API with explicit capabilities, path validation, authorization, resource limits, audit events, and reconnectable operations.

A conceptual client interface follows:

```ts
export interface WorkspaceComputerClient {
  ensure(input: EnsureComputerInput): Promise<ComputerLease>;
  status(workspaceId: string): Promise<ComputerStatus>;
  stop(workspaceId: string, reason?: string): Promise<void>;

  files: {
    read(input: ReadFileInput): Promise<Uint8Array>;
    write(input: WriteFileInput): Promise<FileRevision>;
    list(input: ListDirectoryInput): Promise<FileEntry[]>;
    stat(input: StatFileInput): Promise<FileInfo>;
    search(input: SearchFilesInput): Promise<SearchResult[]>;
  };

  shell: {
    exec(input: ExecCommandInput): Promise<ExecCommandResult>;
    start(input: StartProcessInput): Promise<ProcessHandle>;
    status(input: ProcessStatusInput): Promise<ProcessStatus>;
    read(input: ReadProcessInput): AsyncIterable<ProcessOutput>;
    write(input: WriteProcessInput): Promise<void>;
    stop(input: StopProcessInput): Promise<void>;
  };

  browser: {
    start(input: StartBrowserInput): Promise<BrowserSession>;
    perform(input: BrowserActionInput): Promise<BrowserActionResult>;
    observe(input: ObserveBrowserInput): Promise<BrowserObservation>;
    createViewer(input: CreateViewerInput): Promise<ViewerSession>;
    setController(input: SetBrowserControllerInput): Promise<void>;
    stop(input: StopBrowserInput): Promise<void>;
  };

  tools: {
    list(input: ListWorkspaceToolsInput): Promise<ToolManifest[]>;
    invoke(input: InvokeWorkspaceToolInput): Promise<unknown>;
  };
}
```

The exact language and transport can change. The semantics should remain stable.

### Transport requirements

- Authenticated and encrypted connections.
- Bidirectional event streaming.
- Request IDs and idempotency keys.
- Cancellation.
- Reconnection to existing jobs and browser sessions.
- Explicit protocol version and capability negotiation.
- Bounded message and output sizes.
- Structured errors instead of parsing terminal text.

WebSocket or HTTP/2 streaming are both reasonable implementations. The protocol should not depend on a provider's private network or metadata service.

### Logical paths only

Absolute paths from the web server must never cross the protocol boundary.

Inside every computer, use fixed paths:

```text
/workspace
/browser-profile
/runtime
/tmp
```

Protocol calls use paths relative to `/workspace`:

```json
{
  "path": "users/abc/channels/app/thread-123/files/report.csv"
}
```

`heswe-computerd` resolves and validates the path. Traversal outside `/workspace` is rejected after normalization and symlink resolution.

### Avoid excessively fine-grained remote operations

Remote file operations are appropriate for reading a document, writing an artifact, listing a directory, or uploading a result. They are not appropriate for tens of thousands of individual filesystem calls.

Filesystem-heavy work should execute close to the data:

```sh
grep -R "customer_id" .
find . -type f -mtime -7
python scripts/analyze_repository.py
```

Only the useful result should cross the protocol.

## Long-running processes

The current command tool is mostly request-response oriented. A workspace computer should also support persistent jobs:

```text
shell.start("npm run dev") -> processId
shell.read(processId)
shell.status(processId)
shell.stop(processId)
```

The process belongs to the workspace computer, not to a particular model request. This allows:

- A development server to remain alive across agent turns.
- A build or data job to continue while the Agent Service is not active.
- A user to interact with a browser while no model request is running.
- A restarted Agent Service to reconnect to existing work.

Every start operation should accept an idempotency key so retries do not accidentally launch duplicate jobs.

## Workspace tools

Current workspace tools are JavaScript packages loaded dynamically. Their factory code executes while the tool is loaded, so it must not be imported by the shared Agent Service.

Workspace tools should be split into a safe declarative manifest and executable implementation:

```text
tools/github-issues/
|-- tool.json
|-- package.json
`-- index.js
```

Example manifest:

```json
{
  "name": "search_github_issues",
  "description": "Search issues in the configured repository.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string" }
    },
    "required": ["query"]
  },
  "entry": "index.js"
}
```

The Agent Service can safely read the manifest and expose it to the model. When selected, the implementation is invoked through `heswe-computerd` and runs inside the workspace sandbox.

Built-in computer tools follow the same remote model:

```text
execute_command -> computer.shell.exec
read_document   -> computer files or document service
edit_document   -> computer files or document service
see             -> computer image service
browser_*       -> computer.browser
```

## Workspace storage

Storage should be introduced in two stages.

### Stage 1: same-host workspace directory

The first production-shaped implementation should preserve the current layout:

```text
One Linux server
|-- Heswe web server
|-- Agent Service
|-- agentd
|-- /srv/heswe/workspaces/<workspace-id>
`-- sandbox bind-mounts that directory as /workspace
```

Benefits:

- The current workspace directory remains the source of truth.
- `AppWorkspaceService` can continue to use the local filesystem.
- The sandbox gains real isolation without a distributed storage rewrite.
- CLI, browser, and idle-stop behavior can be validated early.

The directory must still be backed up to another machine or object store. Local NVMe must not be the only durable copy.

### Stage 2: portable workspace placement

For multi-node operation, replace absolute directory ownership in the registry with logical metadata:

```text
workspace_id
storage_key
home_site
assigned_node_id
workspace_revision
lease_epoch
checkpoint_id
runtime_state
last_active_at
```

A node hydrates the workspace into local storage, mounts it into the computer, and commits changed state back to durable storage when the computer stops.

Only one node may hold the writable workspace lease at a time. Every lease has a monotonically increasing fencing token. A stale node must be unable to publish a checkpoint after the workspace has moved elsewhere.

### Optional lightweight storage service

A later optimization can separate safe workspace storage access from full computer startup:

```text
Agent Service
|-- WorkspaceStorageClient
`-- optional WorkspaceComputerClient
```

The storage client can read thread history, instructions, skills, uploads, and declarative tool manifests while no sandbox is running. The full computer starts only for executable work.

This supports pure chat without paying for a Linux environment while preserving the workspace as the durable source of truth.

## Lifecycle

A workspace computer should have an explicit state machine:

```text
COLD
  -> STARTING
  -> READY
  -> BUSY
  -> WAITING_FOR_USER
  -> IDLE
  -> CHECKPOINTING
  -> COLD

Any active state may also move to FAILED.
```

### Wake flow

1. A message, timer, webhook, or scheduled task starts an agent run.
2. The Agent Service requests `ensureComputer(workspaceId)` when executable work is expected.
3. The scheduler chooses an execution node.
4. `agentd` acquires the workspace lease and prepares storage.
5. The runtime starts the sandbox and `heswe-computerd`.
6. The Agent Service receives a short-lived computer session token.
7. Tool calls execute through the computer protocol.

The computer can start in parallel with the first model call. In many tasks, model reasoning hides most of the wake latency.

### Sleep flow

1. Stop accepting new mutating operations.
2. Wait for or cancel in-flight operations according to policy.
3. Flush thread logs and workspace files.
4. Save browser profile state.
5. Commit a new workspace revision.
6. Release the workspace lease.
7. Destroy the sandbox.

The default cold state retains files and application checkpoints but no process memory.

### Warm and hibernated states

Warm freeze and full-memory snapshots may be added later:

- **Warm freeze:** no CPU, but RAM remains allocated.
- **Hibernated:** process memory is stored as a runtime-specific snapshot.
- **Cold:** only portable files and application state remain.

Cold must remain the portable default. Memory snapshots are an optimization for compatible hosts, runtimes, and CPU generations.

## Browser and user interaction

The workspace computer should begin as CLI-only. Browser and streaming processes start only when required.

```text
CLI mode
|-- heswe-computerd
`-- shell only when needed

Browser mode
|-- heswe-computerd
|-- virtual display
`-- Chromium

Viewer mode
|-- heswe-computerd
|-- virtual display
|-- Chromium
`-- display or application stream
```

A full desktop environment is not required initially. Chromium can run on Xvfb, a lightweight Wayland compositor, or another virtual display with a small window manager.

### Browser control state

The computer owns an explicit control lock:

```text
AGENT_CONTROL
  -> USER_CONTROL
  -> AGENT_CONTROL
```

When the user takes control:

1. New agent browser actions pause or are rejected.
2. The user receives keyboard and mouse access.
3. The agent run records that it is waiting.
4. The user completes login, MFA, CAPTCHA, payment, or another sensitive step.
5. The user returns control.
6. The agent observes the current page again before acting.

Agent and user input must never be applied concurrently.

### Sensitive input

For passwords, payment details, or MFA:

- Pause agent screenshots and DOM inspection.
- Do not record keystrokes.
- Suspend or redact session recording.
- Resume agent observation only after the sensitive step is complete.

The authenticated browser profile may remain in the workspace computer, but the Agent Service should not receive raw credentials.

### Client UI

Add a `Computer` tab or panel in the shared Heswe client with:

- Computer state: starting, ready, busy, waiting, idle, or stopped.
- Browser view.
- `Take control` and `Return control` actions.
- Stop and restart actions.
- Current agent activity.
- Optional terminal or process list later.

The viewer uses a separate streaming connection. The normal Heswe event stream only announces state changes and invalidations.

## Execution nodes and provider neutrality

Every execution server runs the same `agentd` package and sandbox image.

A node registers capabilities such as:

```json
{
  "nodeId": "node-17",
  "site": "owned-us-east",
  "freeCpu": 28,
  "freeMemoryMb": 72000,
  "freeDiskGb": 1400,
  "kvm": true,
  "gpu": false,
  "runtimes": ["container", "gvisor", "kata"],
  "images": ["heswe-computer:1"]
}
```

The node should establish an outbound authenticated connection to the control plane. Normal operation must not require public SSH, a public container runtime, or a public Firecracker API.

Cloud support belongs in small capacity adapters:

```ts
export interface CapacityProvider {
  requestNodes(input: RequestNodesInput): Promise<ProvisioningOperation>;
  terminateNode(nodeId: string): Promise<void>;
  getNodeStatus(nodeId: string): Promise<NodeStatus>;
}
```

Initial implementations:

- `StaticCapacityProvider` for owned and rented servers.
- `AwsCapacityProvider` for EC2 overflow.
- `GcpCapacityProvider` for Compute Engine overflow.

After a node starts and registers, the rest of Heswe should not care which provider created it.

### Site model

Do not build one Kubernetes control plane stretched across unrelated providers and regions. Treat each provider or region as an independent execution site behind the same global placement API.

```text
Global placement service
|-- owned-new-york
|-- aws-us-east
|-- gcp-us-central
`-- owned-europe
```

A site can begin as one server and later become a local cluster.

## Isolation model

Plain Linux users and directories are not a sufficient boundary for arbitrary agent commands and workspace tools.

The first hosted implementation should use:

- A rootless container where practical.
- User namespaces.
- cgroup v2 CPU, memory, process, I/O, and storage limits.
- A read-only root filesystem.
- A writable workspace mount and size-limited temporary storage.
- Dropped Linux capabilities.
- Seccomp policy.
- No host Docker or containerd socket.
- No host home directory or source checkout mount.
- Controlled network egress.
- gVisor when compatible with the workload.

For stronger public multi-tenant isolation, add Kata Containers or Firecracker-backed computers behind the same protocol.

The runtime class should be selected by policy:

```text
trusted   -> ordinary container
sandboxed -> gVisor
microvm   -> Kata or Firecracker
```

## Secrets

Secrets fall into two categories.

### Platform secrets

These must never enter the workspace computer:

- Better Auth secret.
- Authentication database access.
- Node enrollment credentials.
- Cloud provider credentials.
- Object-storage master credentials.
- Model-provider master keys paid for by Heswe.
- Other users' provider keys.

If Heswe pays for model inference, the Agent Service should call providers directly or issue a short-lived scoped token to a model gateway.

### Workspace secrets

Workspace-owned integration credentials may be made available to the computer according to workspace policy. Workspace executable code must be considered capable of reading any secret injected into that computer.

Prefer short-lived, scoped credentials where possible. Record which capability was granted, to which computer, and for how long.

## Concurrency and leases

The first implementation should allow one active mutating task per workspace computer or serialize mutating tool operations per workspace.

Different threads may have separate:

- PTY sessions.
- Process IDs.
- Browser contexts.
- Temporary directories.

They still share the workspace filesystem. Without stronger coordination, concurrent edits can conflict.

The system must enforce:

- One writable computer lease per workspace.
- A fencing token on every mutating request.
- Idempotency keys for process starts and side-effecting tool calls.
- Cancellation and timeout policy.
- Explicit read-only jobs if concurrent analysis is later supported.

Independent concurrent agents can eventually work on workspace snapshots or branches and merge results through an explicit workflow.

## Mapping to the current Heswe codebase

The current branch already has a useful process boundary:

```text
SvelteKit API
  -> AppWorkspaceService
    -> ProcessAgentRuntime
      -> worker process
        -> InProcessChatAgentRuntime
          -> ThreadAgent
            -> aiwrapper ChatAgent
```

The API-to-worker protocol and the runtime dependency injected into `AppWorkspaceService` are good transition points. The internal responsibilities should be rearranged rather than replaced wholesale.

### `packages/agents`

Keep the shared agent and model-loop code here.

Proposed changes:

- Rename the current local child-process launcher to make its development role explicit.
- Extract request, response, event, error, cancellation, and version schemas into a protocol module.
- Add remote computer tool adapters.
- Add a `WorkspaceComputerClient` dependency to the agent runtime.
- Keep a local implementation for tests and development.

Potential layout:

```text
packages/agents/src/
|-- agent-runtime.js
|-- protocol.js
|-- local-agent-runtime.js
|-- remote-computer-tools.js
`-- worker.js
```

The exact location of `ThreadAgent` can remain in `packages/heswe` initially. The important change is that its shell, file-processing, browser, and custom-tool implementations become remote adapters.

### `packages/heswe`

Current components to move behind the computer boundary:

- `PTYShellSessionManager`.
- The implementation of `execute_command`.
- File and document operations that execute native or workspace-controlled code.
- Workspace tool importing and execution.
- Browser automation.

The Agent Service may read safe skill text and declarative tool manifests, but it must not import workspace JavaScript.

### New `packages/computer`

```text
packages/computer/
|-- src/protocol/
|-- src/client/
|-- src/server/
|-- src/files/
|-- src/shell/
|-- src/processes/
|-- src/browser/
`-- src/tools/
```

This package contains:

- Shared protocol schemas.
- `WorkspaceComputerClient`.
- `heswe-computerd`.
- File path enforcement.
- PTY and process management.
- Browser control.
- Workspace tool execution.

### New `packages/agentd`

```text
packages/agentd/
|-- src/server.js
|-- src/node-registration.js
|-- src/sandbox-manager.js
|-- src/workspace-lease-manager.js
|-- src/workspace-volume-manager.js
`-- src/checkpoint-manager.js
```

`agentd` must remain small and trusted. It manages lifecycle and resources but does not directly execute arbitrary agent commands on the host.

### New sandbox image

```text
packages/sandbox-image/
|-- Dockerfile
|-- entrypoint.sh
|-- browser-start.sh
|-- viewer-start.sh
`-- runtime/
```

The image contains:

- Node.js and `heswe-computerd`.
- Common CLI tools.
- Python.
- Git and curl.
- Document-processing dependencies.
- Playwright and Chromium.
- Virtual display and viewer dependencies.

Browser and viewer processes are installed but do not start by default.

### `packages/web`

Proposed changes:

- Replace direct construction of `ProcessAgentRuntime` with a configurable Agent Service runtime.
- Add workspace computer lifecycle and viewer endpoints.
- Add a placement and lease abstraction.
- Replace absolute execution paths in the registry with logical placement metadata in the multi-node phase.
- Put an interface in front of the in-memory event broker so a shared pub/sub implementation can be added later.
- Route Slack and Telegram work through the same Agent Service so different channels cannot start independent writers for one workspace.

Potential endpoints:

```text
GET  /api/workspaces/:id/computer
POST /api/workspaces/:id/computer/start
POST /api/workspaces/:id/computer/stop
POST /api/workspaces/:id/computer/browser/start
POST /api/workspaces/:id/computer/viewer
POST /api/workspaces/:id/computer/control/take
POST /api/workspaces/:id/computer/control/release
```

These endpoints represent user-authorized lifecycle and viewing operations. Internal shell and file RPC should not be exposed directly to the browser.

### `packages/client`

Add:

- Computer tab or panel.
- Runtime status.
- Browser stream.
- Human takeover controls.
- Waiting-for-user state in chat.
- Reconnection after navigation or temporary network loss.

## Suggested implementation sequence

### Milestone 0: define boundaries and protocol tests

- Add `WorkspaceComputerClient` interfaces and schemas.
- Change all protocol paths to workspace-relative paths.
- Add protocol version and capabilities.
- Add conformance tests for local and future remote transports.
- Preserve current behavior with a local adapter.

Acceptance criteria:

- Existing agent tests pass through the new interface.
- Path traversal is rejected.
- Platform secrets are absent from computer requests.
- Worker errors and progress events preserve their current semantics.

### Milestone 1: local `heswe-computerd`

Run the Agent Service outside a local computer daemon, without container isolation yet.

- Move PTY and command execution into `heswe-computerd`.
- Add file RPC.
- Move workspace tool importing and invocation into the daemon.
- Support persistent process handles.
- Keep the workspace on the current local filesystem.

Acceptance criteria:

- The agent loop never directly runs shell commands.
- The Agent Service never imports workspace tools.
- A restarted Agent Service reconnects to an existing process.

### Milestone 2: same-host isolated computers

- Add `agentd` on the same server.
- Launch one container per active workspace.
- Bind-mount the existing workspace directory as `/workspace`.
- Apply CPU, RAM, process, storage, and network limits.
- Add idle stop and clean checkpoint behavior.

Acceptance criteria:

- Arbitrary workspace commands cannot access the host or another workspace.
- Sleeping workspaces consume no sandbox RAM or CPU.
- Workspace files and thread history survive restart.
- A computer crash does not crash the web server or Agent Service.

### Milestone 3: browser and human takeover

- Add Chromium and Playwright.
- Add a virtual display.
- Add browser actions and observations.
- Add a viewer gateway and Computer tab.
- Add exclusive agent/user control.
- Persist the browser profile.

Acceptance criteria:

- The agent can open and use a browser without a viewer running.
- A user can attach to the existing browser without restarting it.
- Agent actions pause during user control.
- Sensitive input can disable agent observation.

### Milestone 4: remote execution nodes

- Let `agentd` register from another server.
- Add node capability reporting and placement.
- Add short-lived computer session tokens.
- Route browser viewing through the session gateway.
- Add node draining and failure handling.

Acceptance criteria:

- The same workspace computer image runs on an owned server and a cloud VM.
- The Agent Service does not know provider-specific instance details.
- A stopped workspace can start on a different compatible node.

### Milestone 5: portable workspace storage

- Replace absolute registry paths with logical storage keys and revisions.
- Add hydration and checkpoint upload.
- Add one writable lease and fencing tokens.
- Add durable backup and failed-node recovery.
- Add a lightweight storage service if pure chat without a computer is needed.

Acceptance criteria:

- A cold workspace can move between execution sites.
- A stale node cannot overwrite a newer checkpoint.
- Workspace ownership and storage revisions remain consistent after failure.

### Milestone 6: stronger isolation and faster resume

- Add gVisor policy where compatible.
- Add Kata or Firecracker runtime support for higher-risk tenants.
- Add warm pools and optional runtime-specific hibernation.
- Add cloud overflow capacity adapters.

Acceptance criteria:

- Runtime class is selected by policy without changing agent code.
- Cold state remains portable across providers.
- Warm and hibernated state are optional optimizations.

## Testing strategy

### Protocol tests

- Version and capability negotiation.
- Request and response validation.
- Cancellation.
- Reconnect and idempotent retry.
- Output truncation and size limits.
- Structured error preservation.

### Security tests

- `../` and symlink path escapes.
- Access to host mounts.
- Access to another workspace.
- Environment-secret leakage.
- Container socket access.
- Process and file descriptor exhaustion.
- Network egress restrictions.
- Malicious workspace tool imports.

### Lifecycle tests

- Cold start and clean stop.
- Crash during a command.
- Agent Service restart during a long-running process.
- Node failure during checkpoint.
- Stale lease rejection.
- Idle eviction.
- Browser profile recovery.

### Browser tests

- Headless automation without viewer.
- Viewer attachment to an existing browser.
- User takeover and release.
- Rejection of concurrent agent input.
- Sensitive input mode.
- Viewer reconnect.

### Concurrency tests

- Two threads requesting writes.
- Duplicate command retry.
- Two nodes attempting to acquire the same workspace.
- Old-node checkpoint after lease replacement.

## Observability and accounting

Record at least:

- Computer startup and ready latency.
- Active, idle, frozen, and stopped time.
- CPU, memory, process, storage, and network use by workspace.
- Command and tool duration.
- Browser and viewer duration.
- Checkpoint size and duration.
- Wake failures and node failures.
- Lease changes.
- User takeover events.

Audit logs should identify the workspace, logical agent, thread, user, computer, node, tool, and lease epoch without recording secrets or unnecessary content.

## Recommended first deployment

Start with one dedicated Linux server:

```text
Heswe server
|-- web API and authentication
|-- Agent Service
|-- workspace registry
|-- agentd
|-- container runtime
|-- local NVMe workspace directories
`-- one isolated computer per active workspace
    |-- heswe-computerd
    |-- CLI tools
    |-- optional Chromium
    `-- optional viewer
```

Use the existing workspace directory as the durable source of truth and back it up externally. Do not start with Kubernetes, Firecracker, distributed filesystems, or multi-cloud scheduling.

The first valuable result is narrower:

> The Heswe agent loop runs outside the workspace environment, while shell commands and workspace tools run through a local `heswe-computerd` inside an isolated container.

Once this boundary works, browser interaction, remote nodes, portable storage, stronger isolation, and cloud overflow can be added without changing how agents think about their computer.

## Alternatives considered

### Put the full agent worker inside every sandbox

This is simpler for local filesystem access, but couples model calls, provider credentials, agent lifecycle, browser state, and computer lifecycle. It also makes pure chat require a computer and makes agent-process recovery more dependent on sandbox recovery.

It remains a valid local fallback, but it should not be the long-term hosted architecture.

### Use one Linux user per agent on a shared host

This has excellent density and is useful as defense in depth. It is not a sufficient boundary for arbitrary commands and dynamically loaded workspace code that share the host kernel and services.

### Start one cloud VM per agent

This gives a clear boundary but wastes capacity, increases startup complexity, and ties orchestration to cloud-provider APIs. A shared execution node hosting isolated workspace computers is more efficient and portable.

### Mount remote filesystems directly into the Agent Service

This makes local filesystem assumptions leak across the architecture, weakens authorization boundaries, and performs poorly for many small operations. Typed storage and computer APIs are easier to secure, audit, version, and move across providers.

### Use full-memory snapshots for every sleeping agent

This preserves exact process state but consumes substantial storage and is tied to runtime and hardware compatibility. Portable application state and files should be the default; memory snapshots should be reserved for cases where reconstruction is unusually expensive.

## Open questions

- Should V1 always pre-wake the computer for every agent turn, or wake only after the first computer tool call?
- Which built-in file and document operations are safe enough for a lightweight storage service without a full computer?
- Should a workspace have one shared browser context or one context per thread?
- Which initial viewer technology best fits the client: KasmVNC, Xpra, noVNC, or a custom WebRTC stream?
- Should the first sandbox runtime be rootless Docker, containerd, or Podman?
- Where should gVisor become mandatory rather than optional?
- Which workspace secrets may be exposed to agent-controlled code?
- How long should computers and browsers remain warm after activity?
- How should users explicitly request that a long-running job keep the computer alive?
- When should Heswe introduce workspace snapshots or branches for concurrent agents?
- Should self-hosted deployments use the same central placement API or allow a direct single-node mode?

## Final recommendation

Implement the architecture in layers:

1. Extract a stable computer interface from the current local shell and file behavior.
2. Keep the agent reasoning loop and model calls in the shared Agent Service.
3. Run `heswe-computerd` locally and move all workspace-controlled executable code behind it.
4. Put `heswe-computerd` inside one isolated container per active workspace.
5. Add Chromium and human takeover only after CLI execution and lifecycle are reliable.
6. Add remote `agentd` nodes and portable workspace storage after the single-host version is proven.

This gives Heswe a clear long-term model without requiring the entire long-term infrastructure in the first release:

> A Heswe workspace is durable state. A Heswe agent is durable intelligence. A workspace computer is temporary, isolated compute that either can use when work requires an operating system.
