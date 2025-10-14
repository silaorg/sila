### Proposal: Tool and Tool-Result Messages in Chat

#### Goal
Enable live visualization of LLM tool calls/results in chat by emitting messages with roles `tool` and `tool-results`, grouped by streaming run index (`idx`).

#### Scope (minimal changes)
- Runtime behavior in `WrapChatAgent.ts` to create/update messages as events stream.
- Light UI tweaks in `ChatApp.svelte` (autoscroll) and `ChatAppMessage.svelte` (labels/icons for new roles).
- Widen `ChatAppData.newMessage` role union to include `"tool" | "tool-results"`.

#### Data model
- `ThreadMessage.role` already accepts arbitrary strings; no storage changes.
- Update creator signature only:
  - `newMessage(role: "user" | "assistant" | "error" | "tool" | "tool-results", ...)`.
- Optional: store `meta.toolName` and `meta.toolId` on tool messages for future UI.

#### Agent wrapper (`packages/core/src/agents/WrapChatAgent.ts`)
- Subscribe to stream events and use `event.data.idx` to group a run’s outputs.
- Maintain:
  - One assistant placeholder message (existing behavior), `inProgress=true` during run.
  - Per `idx`, lazily create tool message (role `tool`) and tool-result message (role `tool-results`), `inProgress=true` while updating.
- For each streaming event:
  - `assistant`: append/replace text from text parts.
  - `tool` (ToolRequest[]): one line per call: `${name} ${JSON.stringify(args)}` (append/replace across updates for same `idx`).
  - `tool-results` (ToolResult[]): `${name} → ${stringOrJSON(result)}` (append/replace across updates for same `idx`).
- On `finished`:
  - Set `inProgress=false` on assistant and any per-idx tool/tool-results messages.
  - Set `assistant.modelProvider`/`assistant.modelId` as today.

Notes:
- Replace-vs-append heuristic: if next text starts with previous text → replace, else append.
- Keep implementation internal maps: `Map<number, { tool?: ThreadMessage; result?: ThreadMessage }>`.

#### UI: `packages/client/src/lib/comps/apps/ChatApp.svelte`
- Autoscroll also for non-user messages (tools/results are AI-side updates):
  - Change the observer logic from `if (msg.role === "assistant")` to `if (msg.role !== "user")` before calling `scrollOnlyIfAutoscroll()`.

#### UI: `packages/client/src/lib/comps/apps/ChatAppMessage.svelte`
- Visuals:
  - Assistant: unchanged.
  - Tool (`role === "tool"`): label “Tool”, wrench-like icon, muted styling.
  - Tool result (`role === "tool-results"`): label “Tool result”, check-like icon, muted styling.
- Body:
  - Render `message.text` via existing Markdown component (works for plain text and fenced JSON if present).
- Progress:
  - Continue showing generating state when `inProgress === true` for any non-user message.

Minimal code adjustments:
- Add icon imports (e.g., `Wrench` and `Check`) from `lucide-svelte` and branch existing header block to handle the two new roles.

#### Acceptance criteria
- During a model run, chat shows:
  - Streaming assistant text.
  - One or more `tool` messages per `idx` rendering tool calls as they are requested.
  - Matching `tool-results` messages per `idx` showing outputs.
- All in-progress flags clear on finish.
- Assistant `modelProvider/modelId` are set as before.
- Autoscroll behaves for tool and tool-results like assistant.
- No breaking changes to existing chats; user messages are unaffected.

#### Out of scope (for now)
- Structured rendering of tool args/results beyond strings/JSON.
- Collapsing tool messages into an embedded block within assistant message.

#### Migration
No data migration. Existing messages remain valid.


