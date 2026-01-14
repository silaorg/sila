# Chat search (dev notes)

## Purpose

Provide a simple chat search for titles and message text.
Index is local and easy to rebuild.
On desktop, keep the index outside the workspace folder.

## Indexing idea

Build a lightweight in-memory index from chat app trees.
Tokenize titles and message bodies into terms.
Store per-thread metadata (title, updatedAt).

## Storage

We persist the index per workspace.
On desktop, store it in app data, outside the workspace directory.
Path: `app.getPath("userData")/search-index/<spaceId>/chat-index.json`.
This avoids sync conflicts in local-first workspaces.

Outside desktop, store a mutable file inside the space.
It lives under `space-v1/files/var/uuid/` in the workspace root.

Format (both desktop and workspace storage):

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
