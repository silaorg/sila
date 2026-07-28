# Thread Runtime Simplification

Status: implemented.

## Result

The current flow is:

```text
Workspace
  -> SlackChannel / TelegramChannel
    -> ThreadedChannelRuntime
      -> InProcessChatAgentRuntime
        -> ThreadAgent
          -> aiwrapper ChatAgent
```

Ownership is intentionally narrow:

- `Workspace` starts and stops channels.
- Channel classes own provider-specific input handling and transport calls.
- Provider parsers, transports, and file stores are separate modules.
- `ThreadedChannelRuntime` owns per-thread serialization, state updates, and
  outbound delivery records.
- `InProcessChatAgentRuntime` owns agent execution and active shell sessions.
- `ThreadStore` owns thread history and legacy migration.

Slack and Telegram share agent-runtime creation and editable progress replies.
They do not share a generic provider event model because their input and file
semantics are meaningfully different.

## Persistence

`messages.jsonl` is an append-only event log. Existing `messages.json` arrays
are migrated lazily when first read.

Message records contain serialized language messages. Delivery records capture
`pending`, `sent`, and `failed` states around provider sends. Every new record
has an ID and timestamp, and existing log bytes are never rewritten.

`state.json` is mutable thread metadata. It is replaced atomically.

## Remaining Limit

Agent messages are persisted at message boundaries before and after an agent
run. Token deltas are not persisted. A process crash during a model response
can therefore lose the unfinished response, but it cannot corrupt or rewrite
the earlier event history.

Token-level persistence is not worth adding unless resumable streaming becomes
a product requirement.
