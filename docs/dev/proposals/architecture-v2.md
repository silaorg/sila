# Sila2 Architecture V2 (Simplified Proposal)

## Summary

Sila2 uses a filesystem-first thread runtime:

- `workspace-gateway` receives messages from Telegram/Slack.
- Gateway spawns an agent process inside the target thread folder.
- Agent owns thread state and appends events to `messages.jsonl`.
- Agent asks gateway to send outbound messages and gets delivery response.
- Gateway is the only component that sends messages to external providers.

This keeps behavior simple, explicit, and auditable.

## Directory Layout

```text
workspace/
  config.json
  assets/
  providers/
    openai.json
  channels/
    telegram/
      config.json
      123/
        messages.jsonl
        files/
    slack/
      config.json
      C123456/
        messages.jsonl
        files/
```

### Notes

- `threads/<channel-type>/config.json` contains defaults for that provider (agent profile, policies, etc.).
- `threads/<channel-type>/<thread-id>/messages.jsonl` is append-only and holds inbound, internal, and outbound delivery events.
- `threads/<channel-type>/<thread-id>/files/` stores uploaded files and agent-generated artifacts.
- Each thread folder may include additional agent-owned runtime files (state, checkpoints, temporary data, locks, etc.) as needed by that agent implementation.

## Components

- `workspace-gateway`:
  - listens to provider webhooks/polling
  - normalizes inbound updates
  - spawns/manages thread agents
  - forwards inbound events to thread agents
  - sends outbound messages to providers
  - returns delivery result events to thread agents
- `thread-agent`:
  - runs in `cwd = threads/<channel-type>/<thread-id>`
  - reads `messages.jsonl` (+ `files/` and any agent-owned runtime files)
  - appends inbound events to `messages.jsonl`
  - decides whether to respond
  - appends outbound intents to `messages.jsonl`
  - sends outbound requests to gateway and records gateway responses

## Message Lifecycle

1. Gateway receives inbound message from provider.
2. Gateway triggers/locates the agent process for this thread.
3. Gateway sends `inbound_event` to agent over IPC.
4. Agent appends `inbound` to `messages.jsonl` and decides whether to reply.
5. If replying, agent appends `pending_send` to `messages.jsonl`.
6. Agent sends `send_request` to gateway over IPC.
7. Gateway sends message to provider API.
8. Gateway returns `send_result` to agent.
9. Agent appends `sent` or `send_failed` to `messages.jsonl`.

## Parent/Child IPC Contract

IPC is bidirectional.

Gateway -> Agent (inbound message):

```json
{
  "type": "inbound_event",
  "event_id": "evt_in_01",
  "provider": "telegram",
  "thread_id": "123",
  "text": "Hi",
  "meta": {
    "provider_message_id": "456"
  }
}
```

Agent -> Gateway (request send):

```json
{
  "type": "send_request",
  "event_id": "evt_out_01",
  "provider": "telegram",
  "thread_id": "123",
  "text": "Hello from Sila2",
  "files": []
}
```

Gateway -> Agent (send response):

```json
{
  "type": "send_result",
  "event_id": "evt_out_01",
  "status": "sent",
  "provider_message_id": "789"
}
```

## Why This Is The Simplest Path

- Single source of truth: one append-only thread log.
- Clear ownership: only gateway talks to external APIs.
- Simple trigger: inbound event -> notify thread agent.
- Easy debugging: thread folder contains everything needed to replay behavior.

## Guardrails (MVP)

- One active agent run per thread (mechanism is implementation-defined).
- Idempotency keys for provider sends (`event_id`).
- Append-only writes to `messages.jsonl` (no in-place mutation).
- Crash-safe flow: agent persists `pending_send` before calling gateway `send_request`.
- Gateway must not send twice for the same `event_id`.

## Near-Term Implementation Milestones

1. Define JSONL event schema (`inbound`, `pending_send`, `sent`, `send_failed`, `internal`).
2. Implement `workspace:init` to scaffold directory structure.
3. Implement gateway adapters for Telegram/Slack inbound events.
4. Implement thread agent runner (spawn + bidirectional IPC).
5. Implement gateway send API with idempotency + structured `send_result`.
