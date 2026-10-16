# How agents work

App agents run in a separate worker process from the public API. The API sends
requests and receives progress events over newline-framed JSON on the worker's
standard input and output. One worker serves each active workspace.
The API starts it on the first message and can restart it after a crash.

```text
SvelteKit API
  -> AppWorkspaceService
    -> ProcessAgentRuntime
      -> agent worker process
        -> InProcessChatAgentRuntime
          -> processThreadMessage
            -> aiwrapper ChatAgent
```

The worker process loads the provider, instructions, workspace tools, and
workspace environment. It does not receive authentication, database, or other
API secrets. Provider keys from the server environment are explicitly
allowed during development. Production keys belong in workspace settings.

`npm run dev` starts workers directly with Node on the same machine.
They are child processes of the API, not a separate service to start.
The workspace is their working directory, not a filesystem boundary. Production starts the same worker in a locked-down Docker
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

## Context compression

Before each agent model call, including tool-loop steps, the runtime estimates
the input size from instructions, tool definitions, and message content. The
default window is 100,000 tokens, capped by the selected model's token context
in the bundled model catalog. Unknown models use the default. Compression starts
at 80% of that window, leaving headroom for output and estimation error.
`InProcessChatAgentRuntime` also accepts `compressionWindowTokens` to lower or
raise the default; the model cap still applies.

The selected model summarizes older history without tools. Recent messages stay
verbatim, tool calls stay with their results, and the latest user request stays
verbatim even during long tool loops. Oversized histories are summarized in
bounded pieces. Current workspace instructions are always supplied separately.

A `compression` event in `messages.jsonl` stores the summary and the number of
original messages it covers. Covered messages are saved before that checkpoint.
Future calls and worker restarts use the summary plus recent history. The full
transcript remains available to the app and channels; summaries are not chat
messages. The local Mock provider keeps its full history and reply cycle.

OpenAI requests replay this local snapshot without a previous response ID or
automatic provider truncation. Tool calls and results use separate Responses
input items, including native patch calls.

Empty, incomplete, oversized, or failed summaries stop the turn without replacing
history. A provider context-overflow rejection gets one compression retry, only
if no response has started. Oversized instructions or a latest user message that
cannot fit produce an explicit error. Token counts are estimates, not provider
usage measurements.
