# Thread Runtime Simplification

## Summary

The current land runtime is already small and understandable:

- `Land` starts channel runtimes.
- each channel adapter receives provider events and sends replies
- `InProcessChatAgentRuntime` runs one in-process agent per thread
- thread data lives on disk in the land directory

The main problem is not overall size. The problem is that thread orchestration, persistence, and provider delivery are still mixed across layers.

This proposal simplifies the shape in two steps:

1. extract a shared threaded channel runtime so Slack and Telegram stop duplicating the same flow
2. extract a real thread store with append-only events so persistence becomes explicit and robust

This keeps the architecture easy to explain while improving crash recovery, streaming persistence, and provider parity.

## Current Shape

Today the flow is roughly:

```text
Land
  -> SlackChannel / TelegramChannel
    -> InProcessChatAgentRuntime
      -> ThreadAgent
        -> aiwrapper ChatAgent
          -> built-in tools + land tools
```

Current responsibilities:

- `packages/land/src/land.js`
  - load env
  - discover channel folders
  - start channel runtimes
- `packages/land/src/channels/slack-channel.js`
  - Slack auth and event handlers
  - thread id resolution
  - per-thread in-memory queue
  - attachment normalization
  - state save
  - outbound Slack send
- `packages/land/src/channels/telegram-channel.js`
  - same shape as Slack, but for Telegram
- `packages/agents/src/chat-agent-runtime.js`
  - load thread messages
  - append inbound user message
  - decide whether to respond
  - run the agentic loop
  - save thread messages

## Current Problems

### 1. Channel runtimes duplicate the same orchestration

Slack and Telegram both do this:

- normalize inbound provider message
- resolve `threadId`
- serialize work per thread
- create `threadDir`
- call `handleThreadMessage`
- save `state.json`
- send outbound reply through provider API

That duplication makes it harder to add another provider and harder to keep behavior aligned.

### 2. Persistence is snapshot-oriented, not event-oriented

`messages.jsonl` is currently treated like a rewritten conversation snapshot.

That creates awkward behavior for:

- streaming assistant output
- tool progress
- delivery retries
- debugging partial failures

### 3. Outbound provider delivery is not modeled as part of thread history

The agent creates an answer, then the channel sends it.
If send fails, thread history does not clearly represent that delivery failure as part of the same thread lifecycle.

### 4. Thread logic and storage logic are coupled

`ThreadAgent` currently owns both:

- conversation policy and model execution
- file format details and legacy migration

That makes it harder to evolve persistence independently.

## Goals

- keep the system easy to explain from memory
- reduce duplicated runtime logic between channels
- make thread persistence append-only and auditable
- support continuous persistence during streaming/tool execution
- model provider delivery state explicitly
- keep in-process execution as the default runtime for now

## Non-Goals

- moving to child processes in this step
- replacing Slack Bolt or Telegraf
- changing land directory layout in a major way
- introducing a database

## Proposed Shape

### 1. Add a shared threaded channel runtime

Introduce a shared runtime layer in `packages/land/src/channels/` that owns the common thread flow.

Example shape:

```js
class ThreadedChannelRuntime {
  async handleInbound(event) {
    const thread = await this.resolveThread(event);
    await this.enqueueThread(thread.threadId, async () => {
      const inbound = await this.normalizeInbound(event, thread);
      const outcome = await this.threadRuntime.handleThreadEvent({
        threadId: thread.threadId,
        threadDir: thread.threadDir,
        inbound,
        sendFile: this.createFileSender(thread),
      });
      await this.applyOutcome(thread, outcome);
    });
  }
}
```

Provider-specific adapters become thinner:

- Slack adapter
  - Slack auth
  - Slack event parsing
  - Slack file fetch/store
  - Slack message send
- Telegram adapter
  - Telegram auth
  - Telegram event parsing
  - Telegram file fetch/store/transcription
  - Telegram message send

Everything else moves into the shared runtime.

### 2. Add a dedicated thread store

Introduce a small thread store abstraction in `packages/agents/src/` or `packages/land/src/channels/`.

Example shape:

```js
class ThreadStore {
  async loadMessages(threadDir) {}
  async appendEvent(threadDir, event) {}
  async saveState(threadDir, state) {}
  async migrateLegacyFiles(threadDir) {}
}
```

This removes file format details from `ThreadAgent`.

### 3. Make `messages.jsonl` a real append-only event log

Instead of rewriting the full conversation history, append structured thread events.

Example event types:

- `inbound`
- `assistant_message_started`
- `assistant_message_completed`
- `tool_result`
- `pending_send`
- `sent`
- `send_failed`
- `internal`

Example:

```json
{"type":"inbound","role":"user","userId":"U123","text":"summarize this","at":"2026-03-11T10:00:00.000Z"}
{"type":"assistant_message_started","messageId":"msg_1","at":"2026-03-11T10:00:01.000Z"}
{"type":"assistant_message_completed","messageId":"msg_1","text":"Here is the summary...","at":"2026-03-11T10:00:04.000Z"}
{"type":"pending_send","messageId":"msg_1","provider":"slack","channelId":"C123","threadTs":"173...","at":"2026-03-11T10:00:04.100Z"}
{"type":"sent","messageId":"msg_1","providerMessageId":"173...","at":"2026-03-11T10:00:04.500Z"}
```

Read-side reconstruction can still build a `LangMessages` conversation for the model.

### 4. Split thread execution from delivery execution

The thread runtime should return outbound intents, not perform provider sends directly.

Example:

```js
{
  events: [...],
  outbound: [
    {
      kind: "message",
      text: "Here is the summary...",
    }
  ],
  state: {
    responded: true,
  }
}
```

Then the channel runtime:

1. persists `pending_send`
2. sends to provider
3. persists `sent` or `send_failed`

This makes delivery failures explicit and replayable.

### 5. Subscribe to agent runtime events for continuous persistence

`aiwrapper` already emits streaming events during the run loop.
We should use that boundary instead of saving only before and after `agent.run()`.

Important constraint:

- stream callbacks mutate the same in-memory assistant message repeatedly
- naive append-on-every-delta would duplicate partial message states

So the first robust version should persist on message boundaries, not every token delta.

Recommended initial rule:

- append `assistant_message_started` when a new assistant message begins
- append `assistant_message_completed` when that message is complete
- append `tool_result` after tool execution completes

That is enough to avoid long silent gaps without introducing noisy token-level event logs.

## Proposed Module Boundaries

### `packages/land`

- `Land`
  - process manager only
- `SlackChannel` / `TelegramChannel`
  - provider IO only
- `ThreadedChannelRuntime`
  - shared inbound -> thread -> outbound orchestration

### `packages/agents`

- `InProcessChatAgentRuntime`
  - runs thread agents and exposes agent events
- `ThreadAgent`
  - policy and model execution only
- `ThreadStore`
  - thread history/state read-write
- `MessageProjector`
  - rebuild `LangMessages` from event log for model context

## Rollout Plan

### Phase 1

- add `ThreadStore`
- move current `messages.jsonl` and `state.json` read/write into it
- keep current external behavior

### Phase 2

- add `ThreadedChannelRuntime`
- move shared queue/state/reply flow out of Slack and Telegram channel classes
- keep provider-specific adapters thin

### Phase 3

- switch `messages.jsonl` from rewritten message snapshots to structured append-only events
- add projector that builds `LangMessages` from events

### Phase 4

- persist outbound delivery lifecycle explicitly with `pending_send`, `sent`, `send_failed`
- use agent runtime event subscription for continuous persistence at message boundaries

## Benefits

- less duplicated code across providers
- clearer ownership
- easier testing
- better recovery after crashes or provider send failures
- better support for streaming and tool-heavy runs
- thread history becomes auditable instead of implicit

## Risks

### More concepts

Adding `ThreadStore` and event projection introduces a few more concepts.

Mitigation:

- keep the APIs small
- keep file-based storage
- keep transport and runtime boundaries explicit

### Migration complexity

Moving from snapshot-style `messages.jsonl` to event-style `messages.jsonl` needs a careful migration story.

Mitigation:

- add a temporary compatibility reader
- migrate lazily on thread load
- keep the old reader for one transition period

### Event schema drift

If event shapes are not stable, replay becomes fragile.

Mitigation:

- define a minimal event schema up front
- validate events at append/read boundaries

## Recommendation

Do this in two concrete implementation steps:

1. extract `ThreadStore` and shared threaded channel orchestration first
2. then move thread history to a true append-only event model with explicit delivery events

That gives us the biggest simplification without over-engineering the system.

