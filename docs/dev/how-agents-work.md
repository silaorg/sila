# How agents work

Every Slack, Telegram, and app thread uses the same in-process agent runtime.
The channel decides how to receive and send messages. The agent runtime decides
how to load history, instructions, skills, tools, and the selected language
model.

```text
channel or app service
  -> InProcessChatAgentRuntime
    -> ThreadAgent
      -> aiwrapper ChatAgent
```

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
