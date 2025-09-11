## Proposal: First‑class tool_call helpers in AIWrapper

### Summary
- Problem: After `chat()` returns tool calls, AIWrapper parses them into `result.tools` but does not add the required assistant message that contains `tool_calls` to the conversation history. Users must synthesize this assistant turn manually before adding tool results, or OpenAI rejects the next request with: “messages with role 'tool' must be a response to a preceding message with 'tool_calls'.”
- Goal: Provide first‑class APIs that add the assistant `tool_calls` message and the tool results message in the correct order, eliminating boilerplate and common errors while remaining model‑agnostic.

### Current Behavior
- Non‑streaming:
  - AIWrapper parses OpenAI `tool_calls` into `result.tools`.
  - AI answer text is placed in `result.answer` and appended to `result.messages` as an assistant message.
  - Users must manually push an assistant message with `tool_calls` before pushing a generic "tool" message (with an array of ToolResult) via `result.addToolUseMessage([...])`.
- Streaming:
  - AIWrapper accumulates `delta.tool_calls` chunks into `result.tools`.
  - AI answer is incrementally accumulated and the last assistant message content is updated.
  - Users still need to synthesize the assistant `tool_calls` turn before sending tool results.

### Pain Point
Most users miss the subtle requirement that tool result messages must be preceded by an assistant message containing `tool_calls`. This causes confusing OpenAI errors and unnecessary boilerplate in every agentic loop.

### Goals
- Make it simple and hard to misuse tool calls in agentic loops.
- Keep AIWrapper model‑agnostic—helpers should not be OpenAI‑specific, but should “just work” with OpenAI‑compatible providers.
- Zero breaking changes.

### Non‑Goals
- We are not changing the internal `transformMessagesForProvider` mapping for tool results. The current mapping from a generic “tool” message with `ToolResult[]` to provider messages is good.
- We are not mandating automatic behavior by default; helpers are opt‑in (with an optional auto mode behind a flag).

### Proposed API Additions

1) Methods on `LangResult`

```ts
// Pseudotype additions
class LangResult {
  tools: ToolRequest[] | null;          // already exists
  messages: LangChatMessageCollection;  // already exists

  // NEW: add a single assistant message with tool_calls synthesized from ToolRequest[]
  addAssistantToolCalls(tools: ToolRequest[]): void;

  // NEW: add both assistant tool_calls and tool results, in correct order
  addToolCallsAndResults(
    tools: ToolRequest[],
    results: ToolResult[],
  ): void;
}
```

Behavior:
- `addAssistantToolCalls` pushes one message: `{ role: "assistant", content: "", tool_calls: [...] }` where each entry includes `{ id, type: 'function', function: { name, arguments: string } }`.
- `addToolCallsAndResults` calls `addAssistantToolCalls(tools)`, then calls the existing `addToolUseMessage(results)` (which adds `{ role: "tool", content: results }`). The OpenAI‑like adapter already maps this to `{ role: 'tool', tool_call_id, content: '...' }` per entry.

2) Method on `LangChatMessageCollection` (optional, parity)

```ts
class LangChatMessageCollection extends Array<LangChatMessage> {
  // NEW: convenience method mirroring the result-level helper
  addAssistantToolCalls(tools: ToolRequest[]): this;
}
```

3) Optional chat flag (future/progressive enhancement)

```ts
// In LangOptions
interface LangOptions {
  autoAssistantToolCalls?: boolean; // default false
}
```

If `autoAssistantToolCalls` is true, and the request contains a generic “tool” message with `ToolResult[]` but no preceding assistant message with `tool_calls`, the provider adapter will synthesize and insert that assistant tool_calls message before mapping tool results. This is off by default to preserve explicit control.

### Usage Examples

#### Non‑streaming loop (recommended explicit helpers)
```ts
let result = await lang.chat(messages, { tools });

if (result.tools && result.tools.length > 0) {
  // Execute tools -> produce ToolResult[]
  const toolResults = await runTools(result.tools);

  // Add the assistant tool_calls + tool results in correct order
  result.addToolCallsAndResults(result.tools, toolResults);

  // Continue the conversation
  result = await lang.chat(result.messages, { tools });
}
```

#### Streaming loop (after tool_calls are complete)
```ts
// During streaming, result.tools is filled incrementally.
// After tool_calls are fully known (on finish or step boundary):
const toolResults = await runTools(result.tools!);
result.addAssistantToolCalls(result.tools!);
result.addToolUseMessage(toolResults);
result = await lang.chat(result.messages, { tools });
```

### Implementation Outline

Files to modify:
- `dist/lang/language-provider.ts/js`
  - Add implementations on `LangResult` and (optionally) `LangChatMessageCollection`.
  - `addAssistantToolCalls(tools)` should:
    - Serialize `arguments` as JSON string.
    - Push a single `{ role: 'assistant', content: '', tool_calls: [...] }`.
  - `addToolCallsAndResults(tools, results)` should:
    - Call `addAssistantToolCalls(tools)` then call existing `addToolUseMessage(results)`.

- `dist/lang/openai-like/openai-like-lang.ts/js`
  - No changes strictly required—the existing `transformMessagesForProvider` already:
    - Passes through unknown fields on assistant messages (so `tool_calls` is preserved to provider).
    - Maps the generic “tool” message with `ToolResult[]` into provider “tool” messages with `tool_call_id` + string content.

Optional (auto mode):
- In the OpenAI‑like adapter, when `LangOptions.autoAssistantToolCalls === true`:
  - If we detect a generic "tool" message with `ToolResult[]` and no prior assistant message containing `tool_calls`, synthesize and prepend the assistant `tool_calls` message based on the captured `result.tools`.

### Backwards Compatibility
- No breaking changes.
- Existing agent loops that already synthesize assistant `tool_calls` still work.
- New helpers reduce boilerplate but are optional.

### Edge Cases
- Empty or malformed tool args: unchanged—callers should validate before invoking implementations.
- Multiple tool calls in a single step: supported—helpers include all calls in a single assistant `tool_calls` message and map each result via the existing `addToolUseMessage` path.
- Streaming partial args: helpers can be called after buffers are finalized (as is already required to get complete JSON arguments).

### Tests to Add
- Non‑streaming:
  - Given `result.tools`, `addToolCallsAndResults` produces a valid request that the OpenAI API accepts (no "tool must be preceded by tool_calls" errors).
  - Verify provider request includes assistant message with `tool_calls` and per‑tool messages with `tool_call_id`.
- Streaming:
  - Accumulate `delta.tool_calls`; after finish, call helpers and verify a valid request on continuation.
- Regression:
  - Existing `addToolUseMessage` behavior remains unchanged.

### Rationale
This change removes a brittle, easy‑to‑miss step from every agent loop while preserving AIWrapper’s model‑agnostic design. It matches how users expect function calling to work and prevents a very common error pattern.

### Alternatives Considered
- Only document the pattern: still leaves every user to implement the same fragile glue.
- Automatically insert assistant `tool_calls` in all cases: reduces control and may surprise power users; proposed as optional flag instead.

### Migration & Docs
- Document the new helpers with short examples in the README and an “Agentic Loop” guide.
- Recommend `addToolCallsAndResults` as the default pattern for non‑streaming loops.

### Impact
- Minimal code in AIWrapper; large UX win for users.
- No provider‑specific hacks; relies on existing message transformation.

