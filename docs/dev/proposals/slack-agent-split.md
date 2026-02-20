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

## Current Problem

`packages/land/src/channels/slack-channel.js` currently mixes:

- Slack transport (`@slack/bolt`, auth, inbound handlers, outbound send)
- thread storage (`messages.json`, `state.json`)
- policy (`#shouldRespond`)
- agent orchestration (`ChatAgent` load/run/save)

That coupling makes the channel harder to test and harder to reuse for other providers.

## Goals

- Keep `slack-channel.js` thin and provider-focused.
- Isolate conversational/runtime logic into `slack-agent.js`.
- Define a stable contract so channel and agent can evolve independently.
- Support an in-process adapter first, and child-process execution second.

## Non-Goals

- Replacing Slack Bolt transport.
- Changing thread folder layout in this step.
- Introducing a generic multi-provider agent framework immediately.

## Proposed Shape

### 1. New agent module

Create `packages/agents/slack-agent.js` with a small API like:

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

### 2. Slack channel as gateway

`slack-channel.js` should:

- validate config and connect to Slack
- normalize incoming messages into a minimal inbound event
- locate/start the appropriate agent runtime
- call the agent and execute returned send intents via Slack API

### 3. Runtime mode abstraction

Add `agentRuntime: "in-process" | "child-process"` in Slack channel config.

- `in-process` (default first): import and call `SlackAgent` directly.
- `child-process` (phase 2): spawn a Node process and communicate via IPC.

This keeps rollout safe: same contract, different runtime.

## Child Process Contract (Phase 2)

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
2. Keep channel in-process using the new module.
3. Add runtime interface (`InProcessAgentRuntime`, `ChildProcessAgentRuntime`).
4. Implement child-process mode behind config flag.
5. Add tests that assert parity between both modes.

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

- Should agent code live in new `packages/agents` or under existing `packages/agent`?
- Do we want one process per thread or a pooled worker model?
- Should thread files move from `messages.json` to append-only `messages.jsonl` in same change or later?
