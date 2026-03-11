# Slack Channel + Agent Split

## Summary

Move Slack-specific "agent behavior" out of `slack-channel.js` into a dedicated `slack-agent.js`.
The Slack channel should become a transport/runtime gateway:

- receive Slack events
- normalize and route events to an agent runtime
- send outbound Slack messages requested by the agent

The agent should own thread logic:

- thread history/state persistence
- respond vs no-respond decision
- LLM execution and answer generation

This follows the direction in `docs/dev/proposals/architecture-v2.md` and gives us a clean provider gateway <-> thread agent boundary.
For v1, behavior and message handling should stay the same as today, and runtime stays in-process.

Part of this proposal is now implemented:

- `slack-channel.js` is thinner and more transport-focused
- shared thread orchestration now lives in `ThreadedChannelRuntime`
- generic agent execution now lives in the in-process chat runtime and thread agent layer

What is still missing is the dedicated Slack-specific runtime boundary:

- `slack-agent.js` is only a thin alias today, not a real Slack-specific agent module
- there is no `InProcessSlackAgentRuntime` / `ChildProcessSlackAgentRuntime` split yet
- the provider <-> agent boundary is still generic and in-process rather than a distinct Slack contract

## Current Problem

`packages/silaland/src/channels/slack-channel.js` currently mixes:

- Slack transport (`@slack/bolt`, auth, inbound handlers, outbound send)
- thread storage (`messages.json`, `state.json`)
- policy (`#shouldRespond`)
- agent orchestration (`ChatAgent` load/run/save)

That coupling makes the channel harder to test and harder to reuse for other providers.

## Goals

- Keep `slack-channel.js` thin and provider-focused.
- Isolate conversational/runtime logic into `slack-agent.js`.
- Define a stable contract so channel and agent can evolve independently.
- Keep current message behavior and storage format unchanged in v1.
- Use in-process execution in v1, but through an API boundary that can support child-process or other transports later.

## Non-Goals

- Replacing Slack Bolt transport.
- Changing thread folder layout or message file formats in this step.
- Introducing a generic multi-provider agent framework immediately.
- Shipping child-process runtime in v1.

## Proposed Shape

### 1. New agent module

Create `packages/agents/src/slack-agent.js` with a small API like:

```js
export class SlackAgent {
  constructor({ threadDir, openAiApiKey, aiModel })
  async handleInbound({ userId, text, channelId, threadTs })
}
```

`handleInbound` performs message persistence, decision, model run, and returns zero or more outbound intents:

```js
{
  send: [
    { text: "response text", channelId: "C123", threadTs: "173..." }
  ],
  state: { responded: true, updatedAt: "..." }
}
```

V1 parity rule: keep existing `messages.json` and `state.json` content/shape, and keep current response behavior.

### 2. Slack channel as gateway

`slack-channel.js` should:

- validate config and connect to Slack
- normalize incoming messages into a minimal inbound event
- locate/start the appropriate agent runtime
- call the agent and execute returned send intents via Slack API

### 3. Runtime mode abstraction

Define a runtime adapter interface now, but only implement in-process mode in v1.

- `InProcessSlackAgentRuntime` (v1): import and call `SlackAgent` directly.
- `ChildProcessSlackAgentRuntime` (future): same interface, different transport.
- Other transports can reuse the same contract later.

This keeps rollout safe and keeps the upgrade path open without changing channel/agent business logic.

## Future Transport Contract (Phase 2+)

### Channel -> Agent

```json
{
  "type": "inbound_event",
  "eventId": "evt_123",
  "threadId": "C123_173...",
  "channelId": "C123",
  "threadTs": "173...",
  "userId": "U123",
  "text": "Can you summarize this?"
}
```

### Agent -> Channel

```json
{
  "type": "send_request",
  "eventId": "evt_123",
  "channelId": "C123",
  "threadTs": "173...",
  "text": "Here is a summary..."
}
```

### Channel -> Agent result

```json
{
  "type": "send_result",
  "eventId": "evt_123",
  "status": "sent",
  "providerMessageId": "173...."
}
```

## Recommended Rollout

1. Extract current logic into `SlackAgent` module with no behavior changes.
2. Add runtime interface and implement only `InProcessSlackAgentRuntime`.
3. Keep channel wired to in-process runtime only (no child-process config yet).
4. Add parity tests that assert message/state files and outbound text match current behavior.
5. Add optional runtime selection and child-process transport later without changing agent logic.

## Benefits

- clearer ownership and boundaries
- easier unit tests for decision/runtime logic
- easier future provider support (Telegram/Email can reuse runtime shape)
- safer restarts/isolation in child-process mode

## Risks and Mitigations

- More moving parts in child-process mode.
  - Mitigation: ship in-process first and gate child-process mode behind config.
- IPC/event mismatch bugs.
  - Mitigation: validate IPC payloads with zod schemas on both sides.
- Process churn per message if spawn strategy is naive.
  - Mitigation: keep one worker per active thread with idle timeout.

## Open Questions

- Should we keep a flat agent package API (`@sila/agents`) or expose provider-specific entry points as subpaths?
- Do we want one process per thread or a pooled worker model?
- Should thread files move from `messages.json` to append-only `messages.jsonl` in same change or later?
