### Search agent tool (aiwrapper chatAgent)

## Summary

Add a model-agnostic search tool that routes queries through an AIWrapper
`ChatAgent`. The search agent selects sources and returns compact results.

## Goal

Support search for any model without relying on OpenAI-only API features.

## Minimal flow

1) Main chat asks for search.
2) Search tool calls the search agent.
3) Search agent selects sources and runs sub-queries.
4) Search agent returns results with citations.
5) Main chat uses results in its reply.

## Scope

- One search tool for all models.
- Reuse the existing agent stack and tool wiring.
- Keep v1 small and testable.

## Output shape

Return a compact JSON payload.

Example:

```json
{
  "query": "Sila workspace search",
  "sources": ["docs", "web"],
  "items": [
    {
      "title": "Search in workspaces",
      "url": "sila://docs/dev/proposals/search-in-workspaces.md",
      "snippet": "Hybrid search proposal.",
      "score": 0.82
    }
  ]
}
```

---

## Settings

- Enable per workspace.
- Allow source allowlist (docs, web, files).
- Allow max results limit.

---

## Integration notes

- Implement as a tool in `packages/core/src/agents`.
- Use `ChatAgent.run(...)` with a short system prompt.
- Share tool context and permissions with the main agent.
- Return a single tool result payload to the main agent.

---

## Rollout

Phase 1:
- Tool supports local docs + workspace files.
- No external web search.

Phase 2:
- Add web search via provider API.
- Add per-provider usage limits.

---

## Open questions

- Where to store search logs per workspace.
- How to show source attribution in the UI.
