# Agent computers

Status: proposal. Local workers and the gVisor launcher already exist.
VMs, sleep, remote workers, and S3 storage are not implemented.

## Direction

Run an agent and its tools together on one computer.
Keep the model loop, instructions, history, shell, and files there.
The API decides who can use it and what it can access.

During development, that computer is the developer's machine.
`npm run dev` starts the API and launches Node workers when needed.
A worker is a child process on the same system.
There is no separate agent service to configure.

For hosting, prefer a small VM or microVM with ordinary Linux tools.
Keep it running while needed, then pause or stop it.
Removing the computer must not remove the user's saved files.

Use one computer per active workspace initially. All code inside it shares
that workspace's access. Different access grants need separate computers,
or a clean restart with a new grant.

## Responsibilities

| API and launcher | Agent computer |
| --- | --- |
| Sign-in and workspace access | Instructions and model loop |
| Start, pause, stop, and remove compute | Tools, shell, and child processes |
| Choose file grants and resource limits | Work with the granted files |
| Deliver messages and show progress | Store history and produce results |
| Hold infrastructure credentials | Read its runtime source |

The API sends messages to the worker. It does not call each tool remotely.
Start from the existing worker protocol: requests, progress events, and results.
Add cancellation, status, and checkpointing when the launcher needs them.

Remote connections need authentication, stable request IDs, and event cursors.
A reconnect must not repeat a shell command or lose an accepted message.
Persist delivery state before acknowledging a message to the caller.

## Lifecycle

- **Running:** the agent or a retained process is doing work.
- **Idle:** the computer is warm and waiting for another message.
- **Paused:** a provider has saved memory and disk for later resume.
- **Stopped:** processes are gone; durable files remain for a fresh start.
- **Removed:** compute and disposable disks are deleted; saved files remain.

Start with an idle timeout and stop/start. Add memory pause when supported.
Do not call a fresh boot a resume of running processes.
[E2B supports pause and resume](https://docs.e2b.dev/sandbox/persistence).
A self-hosted microVM runner must manage snapshots and disks itself.
[Firecracker snapshots](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md)
do not guarantee that network connections survive restoration.

Before stopping, stop accepting work, drain or cancel it, and save changes.
Confirm the checkpoint before discarding the last writable disk.
If saving fails, keep the disk and report the failure.
Refresh file grants and credentials before resuming.
A reduced grant requires a clean computer without old cached files or memory.

Keep Slack and Telegram workers running until external message delivery can
wake them. A sleeping process cannot receive messages or run a timer.
Retained background processes also keep the computer active unless paused.

## State and access

The API owns workspace access and compute assignments.
The workspace owns history, instructions, skills, tools, and results.
Treat a workspace as shared access to all files visible inside its computer.
Separate user thread URLs do not isolate users from workspace shell commands.

Keep one active computer writing each workspace.
Before moving it, stop the old writer and finish saving its files.
A missed heartbeat alone is not proof that the old writer stopped.
Within a computer, start with one mutating run at a time.
Background processes count as writers until they stop.

Provider keys currently live in workspace settings and are readable there.
For hosted billing, add an external inference service that holds provider keys
and enforces model access and spending limits. Runtime edits cannot change
those limits. Direct user keys can remain an explicit workspace setting.

Make runtime source readable first. Runtime modification can come later.
If added, select a reviewed revision on restart and retain a working version
for rollback. This is not a prerequisite for hosting an agent.

## First implementation

1. Keep local workers working through `npm run dev`.
2. Choose one VM provider and launch the existing complete worker there.
3. Add authenticated delivery, cancellation, and explicit compute cleanup.
4. Implement scoped files and checkpoint recovery before removing VMs.
5. Add idle stop/start, then provider-supported pause and resume.
6. Route Slack, Telegram, and scheduled work through the same delivery path.

Use [platforms and instances](platforms-and-workspace-instances.md) for hosting
choices and [workspace sandboxing](workspace-agent-sandboxing.md) for files
and isolation. [Display sessions](workspace-display-sessions.md) remain optional.
