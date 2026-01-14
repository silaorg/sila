# Search in chats (MVP)

## Goal

Add a simple chat search for desktop first.

Users click a search button in the sidebar.
A Swins modal opens with results.
Search matches thread titles and chat message text.
Text documents are out of scope for v1.

## Why now

We already have a full search proposal.
We need a smaller first step.
This proposal ships only chat search.

## UX

- Add a search button to the sidebar.
- Button opens a Swins modal.
- Modal shows a query input and results.
- Result shows thread title, snippet, and date.
- Clicking a result opens the thread.

## Data sources

- Thread titles.
- Chat message content (user + assistant).

## Index location

Store the index in the app-local data folder.
Use Electron `app.getPath("userData")`.
Keep one index per workspace.

Example path:
`<userData>/search-index/<spaceId>/`

## Index format (simple)

Prefer a minimal inverted index.
Keep data readable and easy to rebuild.

Files:
- `manifest.json`
- `threads.jsonl`
- `postings.jsonl`
- `term-dict.json`

### `threads.jsonl`

Each line is a thread.

```json
{"threadId":"t1","title":"Project plan","updatedAt":"2025-01-02T10:00:00Z"}
```

### `postings.jsonl`

Each line is a token entry.

```json
{"term":"plan","hits":[{"threadId":"t1","count":3,"lastOffset":120}]}
```

### `term-dict.json`

Keep a compact list of terms.
Store document frequency and total counts.

```json
{"plan":{"df":1,"tf":3}}
```

## Index format (SQLite option)

Use SQLite on desktop for speed.
Keep JSONL as a fallback.

Tables:
- `threads(thread_id, title, updated_at)`
- `messages(message_id, thread_id, content, created_at)`
- `terms(term, df, tf)`
- `postings(term, thread_id, count, last_offset)`

## Tokenization

- Lowercase.
- Strip punctuation.
- Split on whitespace.
- Drop tokens shorter than 2 chars.

Keep it simple for v1.
No stemming or language detection.

## Indexing flow

- Build index on workspace open.
- Rebuild if no index exists.
- Update on thread change.
- Use a debounce timer (500ms).

## Query flow

- Tokenize query.
- Find matching threads.
- Score by term frequency.
- Boost title matches.
- Sort by score, then updatedAt.

## Modal behavior

- Start empty with a hint.
- Show results after first query.
- Show a "No results" state.

## Future upgrades

- Add document search in the same modal.
- Add fuzzy matching.
- Add recency boosts.
- Add per-message hits in the UI.

## Risks

- Index size grows with long chats.
- JSONL reads can be slow on huge workspaces.

Mitigation: switch to SQLite.

## Open questions

- Where to store the index on mobile.
- Should we index deleted threads.
- Max index size per workspace.
