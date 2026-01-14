# Chat search (dev notes)

## Purpose

Chat search scans chat titles and message text.
It builds an index per workspace.
Desktop builds persist that index outside the workspace folder.

## Indexing idea

We build the index from chat app trees.
Each entry stores a thread title, messages, and updatedAt.
Tokenization is simple and runs locally.

## Storage

We persist the index per workspace.
On desktop, store it in app data, outside the workspace directory.
Path: `app.getPath("userData")/search-index/<spaceId>/chat-index.json`.
This avoids sync conflicts in local-first workspaces.
Outside desktop, we keep the index in memory.
It rebuilds when you open chat search.

Format (desktop storage):

```json
{
  "version": 1,
  "updatedAt": 1710000000000,
  "entries": [
    {
      "threadId": "app-tree-id",
      "title": "Chat title",
      "messages": ["message text"],
      "updatedAt": 1710000000000
    }
  ]
}
```

## Query flow

- Tokenize query.
- Match threads that contain all tokens.
- Score by term frequency with title boost.
- Sort by score, then updatedAt.

## Update flow

- Load the persisted index if it exists.
- Compare app tree `updatedAt` to cached entries.
- Rebuild only changed threads.
- Keep cached messages when unchanged.

## Limitations

- No document/file search.
- No fuzzy match or stemming.
- Large workspaces pay less rebuild cost on open.

## Next iterations

- Use a richer index format (JSONL or SQLite).
- Add change observers to refresh without opening search.
- Add file/document search in the same UI.
- Improve ranking (recency, field weighting).

## Desktop backend

Electron runs search in the main process.
The UI calls it through IPC.

IPC handlers:

- `sila:chat-search:load-index`
- `sila:chat-search:save-index`
- `sila:chat-search:query`

Renderer bridge: `window.desktopSearch`.
