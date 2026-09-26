# Workspace runtime lifecycle

Status: proposed after the [September review](../review-2026-09-26.md).

Give each workspace one owner for accepting work, changing settings, and stopping its runtime.

## Problem

`AppWorkspaceService` waits for a snapshot of thread queues during reset. New work can enter while it waits. Settings can stop a runtime that another message has just acquired.

The web server caches services without disposing of them. The Docker runtime can kill its client process without explicitly removing the container.

The worker stops its runtime without tracking active requests. These are parts of one lifecycle, but they currently act independently.

## Smallest useful change

Add admission state to `AppWorkspaceService`:

- Running: accept messages and keep per-thread ordering.
- Resetting: hold new messages until the configuration change finishes.
- Stopping: reject new messages, drain admitted work, then stop.

Serialize settings changes. A reset closes admission before collecting active work. It drains that work, updates configuration, stops the old runtime, then reopens admission.

Define failure behavior explicitly. A failed update must not leave admission closed forever. The caller must know whether the previous configuration remains active or recovery is needed.

Keep independent threads concurrent outside reset and shutdown. Do not put all messages in one global queue.

## Container ownership

Keep Docker lifecycle operations in `RunscAgentRuntime`. It knows the fixed container name and workspace identity.

On timeout or worker failure, explicitly stop and remove that container. Bound those operations and surface cleanup failures. Do not delete an existing container merely because its name matches a new launch.

Add ownership labels and verify them during recovery. A replacement server must distinguish its own abandoned container from another active owner's work.

Keep the local process implementation simpler. It should not know Docker arguments or container names.

## Server ownership

The web service registry must expose shutdown. Stop accepting requests, drain workspace work, stop runtimes, then close shared resources.

Add idle eviction only after shutdown is correct. Never evict a workspace with active or queued work.

Keep this in the existing process first. Placement across servers remains a separate proposal.

## Checks before merging

- [ ] A settings change cannot stop a newly admitted message.
- [ ] Two settings changes apply in order without losing keys.
- [ ] Threads still run concurrently during normal operation.
- [ ] Initialization or settings failure leaves a usable admission state.
- [ ] Shutdown rejects new work and completes within its deadline.
- [ ] Worker stdin closure drains or cancels active work predictably.
- [ ] A failed Docker client leaves no owned container running.
- [ ] Cleanup failure reports the remaining container identity.
- [ ] A restart can recover its own abandoned container safely.
- [ ] Linux tests verify real container state, not only launch arguments.
