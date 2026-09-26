# Proposal: Workspace Computers for Heswe Agents

Status: Draft  
Audience: Heswe developers

## Summary

Run the complete agent runtime inside its workspace computer. Keep the public
API and control plane thin.

The workspace computer contains the agent's model loop, prompts, conversation
state, skills, tools, files, shell, processes, and optional browser. The agent
can inspect the code that determines how it works. With permission, it can
prepare and activate a versioned modification to that code.

The control plane authenticates users, starts and stops computers, delivers
events, enforces external permissions and resource limits, brokers inference
and secrets, and records an audit trail. It does not decide how the agent
reasons or which tools it uses.

The invariant is:

> Agency lives inside the workspace computer. Authority remains outside it.

An agent may change its implementation, but editing that implementation cannot
grant it more authority. External services enforce every external capability.

## Decision requested

Approve the following direction:

1. Run the complete agent runtime and model loop inside the workspace sandbox.
2. Keep authentication, authorization, placement, resource policy, audit, and
   external capability enforcement in the control plane.
3. Give the agent inference through a scoped broker instead of placing model
   provider credentials in the sandbox.
4. Make the agent runtime readable by the agent and support permissioned,
   versioned modifications with validation and rollback.
5. Give each active workspace one leased workspace computer initially.
6. Use a narrow lifecycle and event protocol between the control plane and the
   workspace computer.
7. Start with one Linux host and local workspace storage.

Sandboxing details remain in the
[workspace sandboxing proposal](workspace-agent-sandboxing.md). Platform
placement and multi-server growth remain in the
[platforms and workspace instances proposal](platforms-and-workspace-instances.md).

## Boundary

The relevant separation is behavior versus authority:

| Responsibility | Control plane | Workspace computer |
|---|---:|---:|
| User authentication and membership | Yes | No |
| Sandbox placement and lifecycle | Yes | No |
| Capability and spending limits | Yes | No |
| Provider and infrastructure credentials | Yes | No |
| Audit trail | Yes | No |
| Agent runtime and prompt construction | No | Yes |
| Model-loop orchestration | No | Yes |
| Conversation and working memory | Delivery mirror only | Yes |
| Skills and workspace tools | No | Yes |
| Shell, files, processes, and browser | No | Yes |
| Runtime inspection and proposed edits | No | Yes |

Code inside the workspace computer is untrusted, including the editable agent
runtime. Security cannot depend on a local permission check, system prompt, or
model instruction.

The control plane enforces actual authority. Changing the inference client
cannot reveal a provider key or exceed its budget. Changing an integration
tool cannot make an integration broker accept an unauthorized operation.

## Why the runtime belongs inside

Keeping the runtime with its workspace makes the agent inspectable and
portable. Its behavior comes from code and state it can read rather than an
opaque hosted service. Files, tools, browser state, background processes, and
the model loop also share one lifecycle and a local filesystem.

This gives the agent a direct path to diagnose and improve itself. Hosted and
self-hosted Heswe can run the same workspace runtime, while the public API
remains a small launcher, router, and capability authority.

Every agent turn then needs a workspace computer. Accept that cost initially.
Measure cold starts and keep recently active computers warm for a bounded
period instead of moving the reasoning loop back into the API prematurely.

## Architecture

```text
                              CONTROL PLANE

User
  |
  v
Heswe API
  |-- authenticates and authorizes
  |-- locates the workspace
  |-- starts or stops its computer
  |-- delivers input events
  |-- streams output events
  |-- brokers inference and secrets
  `-- enforces external capabilities
  |
  | Workspace Runtime Protocol
  v

                            EXECUTION PLANE

agentd
  |
  v
workspace sandbox
  |-- immutable supervisor
  |-- complete agent runtime
  |-- conversation state
  |-- skills and tools
  |-- workspace files
  |-- shell and retained processes
  `-- optional browser
```

The workspace supervisor is a small bootstrap. It receives authenticated
events, starts the selected runtime, reports health, and streams agent events.
It does not reason or execute model-selected tools.

## Runtime protocol

The control plane does not remotely drive the agent's files, shell, browser, or
tools. Those are local implementation details.

The internal protocol only needs to:

- ensure or stop a workspace runtime
- deliver an input event idempotently
- stream progress and output events
- cancel a run
- report status and runtime version
- checkpoint durable state

It needs authenticated connections, request IDs, protocol versions,
cancellation, reconnection, bounded output, structured errors, and lease epochs
for mutating operations. It must not depend on a particular cloud provider or
sandbox runtime.

User-facing file and browser-viewer operations can use separate authorized
interfaces. They must not turn the public API into a generic shell or
filesystem proxy.

The separate
[workspace display sessions proposal](workspace-display-sessions.md) defines
shared screen viewing and exclusive human takeover.

## Inference and capabilities

The agent constructs its own model request and sends it to an inference broker.
The broker holds provider credentials and enforces:

- allowed provider and model
- workspace and logical-agent identity
- token, request, and spending limits
- rate limits, cancellation, and accounting

User-supplied model credentials should live in encrypted platform storage, not
a workspace `.env` file visible to arbitrary workspace code. A self-hosted
deployment may run the broker locally while preserving the same boundary.

Use the same pattern for approvals and sensitive integrations. The runtime may
decide when and how to request a capability. The external service decides
whether that request is authorized.

If a durable secret is deliberately injected into the sandbox, assume every
process and tool there can read it. Record the grant and make that consequence
clear to the user.

## Inspectable and editable runtime

The agent should be able to answer "how do you work?" by reading the code that
implements its current loop.

Use three layers:

```text
immutable workspace supervisor
  -> readable, versioned Heswe runtime
    -> logical-agent runtime overlay
```

The base runtime and overlay are mounted read-only into normal agent and shell
processes. A general shell must not implicitly grant permission to replace the
runtime used on the next start.

An authorized change follows a small transaction:

1. The agent or user prepares a candidate overlay revision.
2. Heswe records the base version, diff, requester, and authorization.
3. The candidate passes validation and startup checks.
4. The control plane approves the revision for the next clean restart.
5. The sandbox manager mounts that revision.
6. A failed health check restores the last known-good revision.

Do not hot-patch the executing model loop. Record the runtime revision that
handled each run.

The first implementation may support inspection before modification. Do not
ship modification without authorization, versioning, validation, and rollback.

## State and concurrency

The workspace is the durable source of agent behavior and working state. It
contains conversation history, instructions, skills, tools, artifacts, and
runtime overlays.

The control plane may keep a delivery read model so the UI can load recent
events without waking a cold computer. It should also retain enough external
audit information to show what users sent, what the agent emitted, which
runtime handled it, and which external authority it exercised.

System-managed metadata needs a single writer. Arbitrary shell processes must
not race the supervisor while it updates event logs, runtime selection, or
checkpoint metadata.

Initially permit one mutating agent run per workspace. Serializing individual
RPC calls is insufficient because a background process may keep changing files
after its start call returns. Read-only concurrency, workspace branches, and
merge workflows can come later.

One computer per workspace also makes workspace membership a shared trust
boundary. If members must not see each other's agent or browser state, use
separate workspaces or introduce finer sandboxing before promising that
isolation.

## Mapping to the current codebase

The current process boundary is the starting point:

```text
SvelteKit API
  -> AppWorkspaceService
    -> ProcessAgentRuntime
      -> worker process
        -> InProcessChatAgentRuntime
          -> ThreadAgent
```

Move the complete worker into the workspace sandbox. Keep its instruction
loading, model loop, workspace tools, shell, files, browser, and conversation
persistence together.

Reduce `AppWorkspaceService` to authentication, authorization, event delivery,
UI projections, capability brokerage, and a client for the assigned workspace
runtime. It must not construct the agent, load its instructions, call the
model, or choose tools.

Route app, Slack, Telegram, timers, and webhooks through the same event-delivery
path so they cannot start independent writers for one workspace.

## Implementation sequence

1. Put the current complete worker behind the narrow lifecycle and event
   protocol while preserving local execution.
2. Move model calls through the inference broker and remove provider
   credentials from the worker.
3. Package readable runtime source and report the exact runtime revision.
4. Add permissioned runtime overlays with validation and rollback.
5. Move the complete runtime into one production sandbox per active workspace.
6. Add browser interaction after the runtime and lifecycle are reliable.
7. Add remote home instances before portable placement or automatic failover.

Each step must preserve event delivery, cancellation, runtime recovery, and the
existing agent tests. Security tests must cover unauthorized inference,
runtime replacement, sandbox escape, concurrent writers, and stale leases.

## Open questions

- Is the editable overlay a runtime fork, module replacement, or patch series?
- Which changes require per-action approval rather than a standing permission?
- How much event content should the control-plane read model retain?
- Should browser contexts be shared by the workspace or separated by thread?
- How long should a computer remain warm after activity?
- How does a user explicitly retain a background process and its mutating
  lease?

## Recommendation

Build Heswe around a complete, inspectable agent runtime inside each active
workspace computer. Keep the external platform small but authoritative.

> A Heswe workspace contains an agent that can understand and evolve its own
> implementation. The platform gives that agent compute and capabilities, but
> never delegates authority enforcement to editable agent code.
