# How agents work

App agents run in a separate worker process from the public API. The API sends
requests and receives progress events over newline-framed JSON on the worker's
standard input and output.

```text
SvelteKit API
  -> AppWorkspaceService
    -> ProcessAgentRuntime
      -> agent worker process
        -> InProcessChatAgentRuntime
          -> ThreadAgent
            -> aiwrapper ChatAgent
```

The worker process loads the provider, instructions, workspace tools, and
workspace environment. It does not receive authentication, database, or other
control-plane secrets. Provider keys from the server environment are explicitly
allowed for development compatibility; workspace `.env` values are preferred.

Development starts the worker directly with Node and does not provide a
filesystem sandbox. Production starts the same worker in a locked-down Docker
container using gVisor's `runsc` runtime. The API validates the fixed workspace
mount and translates host paths to `/workspace` before sending them over the
same protocol.

Production startup fails unless Docker exposes `runsc` and the configured
workspace image exists. The sandbox receives workspace `.env` values from its
mounted workspace, but does not inherit API secrets or global provider keys.

Slack and Telegram channels still use the same agent runtime in their channel
process. Moving those channels behind the worker protocol is separate work.

Work for one thread is serialized. Different threads can run concurrently.
Before each message, Heswe reloads workspace instructions and tools so changes
can take effect without restarting the server.

## Instructions

Default instructions come from `packages/heswe`. A workspace can replace the
base instructions by adding files under `agents/default/instructions/`. Files
are loaded recursively in name order.

Heswe always appends managed channel and runtime-path blocks. These tell the
agent which channel it is using and provide the workspace, thread, and source
repository paths.

## Skills and tools

Built-in and workspace [skills](../skills.md) are added to the agent's skill
catalog. Workspace skills override built-in skills with the same name.

Built-in tools cover normal file, shell, patch, and search work. Workspace
[tools](../tools.md) are loaded from `tools/<name>/package.json`. Invalid,
duplicate, or conflicting tools are skipped with a warning.

## History

Each thread stores an append-only `messages.jsonl` event log. Message events
rebuild the model conversation. Slack and Telegram delivery events record
pending, successful, and failed sends.

The runtime persists complete messages, not token deltas. A crash can lose an
unfinished model response, but it does not rewrite earlier history.
