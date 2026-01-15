# Proposal: Chat search performance improvements

## Goal

Reduce per-query IO and CPU cost for chat search.

## Scope

Chat search only. No file/document search.

## Current behavior (summary)

Renderer loads the persisted index on open (desktop) and queries in memory.
Each query scans all threads using the precomputed `searchText`.

## Problems

- Renderer memory grows with large workspaces.
- O(total text) scan per query.

## Proposed changes

### 1) Move query execution to main

Keep an in-memory index per space in the Electron main process.
Renderer sends queries over IPC and receives results only.

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

### 4) Optional: Compact index format

Store a compact JSONL or SQLite index to reduce memory and load time.

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
