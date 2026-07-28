# Slack Channel and Agent Split

Status: superseded.

The original proposal called for a Slack-specific agent package and runtime.
That would duplicate behavior now shared by Slack, Telegram, and the hosted app.

The implemented boundary is:

```text
SlackChannel
  ├── Slack input parser
  ├── Slack file store
  ├── Slack transport
  └── ThreadedChannelRuntime
        └── InProcessChatAgentRuntime
```

`SlackChannel` owns Slack-specific authentication and message handling.
`ThreadedChannelRuntime` owns per-thread execution and delivery records. The
agent runtime is channel-neutral, while file sending is passed in as a
capability.

Do not add a Slack-specific agent runtime unless Slack develops execution
semantics that cannot be expressed through the shared runtime. The exported
`createSlackChatAgent` remains a compatibility alias for `createChatAgent`.
