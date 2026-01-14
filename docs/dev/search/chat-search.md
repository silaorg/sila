# Chat search (dev notes)

## Purpose

Provide a simple chat search for titles and message text.
Index is local and easy to rebuild.

## Indexing idea

Build a lightweight in-memory index from chat app trees.
Tokenize titles and message bodies into terms.
Store per-thread metadata (title, updatedAt).

## Storage

Today we do not persist an index.
Search builds entries from the current space at runtime.

If we persist later, store per workspace under:
`<userData>/search-index/<spaceId>/` (desktop).

## Query flow

- Tokenize query.
- Match threads that contain all tokens.
- Score by term frequency with title boost.
- Sort by score, then updatedAt.

## Limitations

- No document/file search.
- No fuzzy match or stemming.
- Large workspaces require rebuild cost on open.

## Next iterations

- Persist an index to disk (JSONL or SQLite).
- Incremental updates on chat changes.
- Add file/document search in the same UI.
- Improve ranking (recency, field weighting).
