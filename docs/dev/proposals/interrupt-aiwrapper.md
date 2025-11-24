# Interrupting AIWrapper runs

Goal: let the ChatApp “Stop” button halt the active generation quickly and leave the conversation in a consistent state.

## Option 1 — AbortSignal end-to-end (recommended)
- Add an `AbortController` per run in `WrapChatAgent` and pass its `signal` into `chatAgent.run(...)`, then down into AIWrapper’s request/stream layer and tool fetch calls.
- On `stop-message` event from `ChatApp.svelte`/`ChatAppData`, call `controller.abort()`, mark the current assistant message(s) `inProgress=false`, and unsubscribe the streaming handler.
- Ensure AIWrapper closes network streams on abort (propagate signal to fetch/websocket and bail early from tool runners).
- Surface a friendly “stopped” state (optional: write a short assistant note or leave the partial text as-is).
- Pros: minimal code, uses built-in cancellation, stops network I/O. Cons: needs small ABI change in AIWrapper to accept a signal and forward it.

## Option 2 — Cooperative cancel token inside the agent
- Create a `CancelToken` object on each `WrapChatAgent.reply` run; set it when `stop-message` fires.
- In AIWrapper streaming loop and tool execution, check the token between awaits; if set, stop emitting, close connections, and return.
- Cleanup: clear `inProgress`, detach subscriptions, optionally add a “stopped” meta flag on the partial message.
- Pros: works even where fetch abort is not wired; easy to thread through internal loops. Cons: cannot kill a blocked network call unless coupled with AbortSignal; requires diligence to check the token everywhere.

## Option 3 — Isolate runner per chat and terminate
- Run AIWrapper in a dedicated worker/process per conversation; keep a control handle that can be terminated on stop.
- On stop, terminate the worker and drop its stream subscription; mark messages completed or canceled.
- Pros: forceful kill even if the model call hangs. Cons: heavier infra, more IPC, needs safe teardown of file handles/cache.

Suggested path: start with Option 1, adding `AbortSignal` plumbed through ChatAppData → WrapChatAgent → AIWrapper network calls. Fall back to a lightweight token (Option 2) for non-abortable sections (tool execution, local transforms). Only consider Option 3 if upstream providers routinely hang.
