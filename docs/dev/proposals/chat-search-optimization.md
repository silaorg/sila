# Proposal: Chat search performance improvements

## Goal

Reduce per-query IO and CPU cost for chat search.

## Scope

Chat search only. No file/document search.

## Current behavior (summary)

Desktop queries load and parse the index JSON on each query.
Each query builds a combined text string per thread and scans all threads.

## Problems

- IO on every keystroke for large workspaces.
- O(total text) scan per query.
- Duplicate search logic in renderer and main.

## Proposed changes

### 1) Cache the index in the main process

Keep an in-memory index per space in the Electron main process.
Only reload when the index file changes or when we explicitly save.

Minimal API change:

- `queryChatSearch(spaceId, query)` uses cached entries when present.
- `saveChatSearchIndex(spaceId, entries)` refreshes the cache.
- `loadChatSearchIndex(spaceId)` keeps working for renderer rebuilds.

Fallback: if cache is missing, load once and cache.

### 2) Add a precomputed search field

Store a `searchText` field per entry that is lowercased and concatenated.
This avoids `join` + `toLowerCase` per query.

Index entry:

```json
{
  "threadId": "app-tree-id",
  "title": "Chat title",
  "messages": ["message text"],
  "searchText": "chat title message text",
  "updatedAt": 1710000000000
}
```

Search uses `searchText` for `includes` and `countOccurrences`.

### 3) Debounce query in the UI

Add a short debounce (150–200 ms) to query execution.
This reduces IPC and query load on fast typing.

### 4) Optional: Move all search logic to main

Renderer only asks for results.
This removes duplicate search code and keeps behavior consistent.

This is optional if steps 1–3 are enough.

## Migration

On load, accept entries without `searchText`.
When saving, always write `searchText`.
Old indexes remain readable.

## Risks

- Memory use grows with cached index size.
- `searchText` duplicates message text.

## Alternatives

- Use a compact JSONL index or SQLite in the main process.
- Use a simple inverted index for tokens.

## Success criteria

- Zero disk reads per keystroke in desktop builds.
- Query time scales with number of threads, not total text joins.
