### Paginated `read` tool (web + PDF + files)

Goal: let agents read large resources **incrementally** so we don’t flood the model context.

This proposal adds a **single pagination contract** to the existing `read` tool.
It works for:
- web pages (HTML → Defuddle → markdown),
- PDFs (PDF.js text extraction),
- local workspace/chat files (`file:` URIs).

---

## Problem

Today `read` returns the full content as one blob.
This is brittle:
- Large pages/PDFs can exceed tool response limits or swamp context.
- Agents can’t “continue reading” in a consistent way across sources.

We want an agent-friendly pattern:
- read the first chunk,
- decide whether more is needed,
- request the next chunk(s) using the same tool.

---

## Proposed API changes

Keep the tool name: `read`.

### Request parameters

```ts
{
  uri: string;
  cursor?: string;      // opaque continuation token from the previous response
  max_chars?: number;   // default: 8_000; hard cap enforced server-side
}
```

Notes:
- `cursor` is **opaque** to the model. The model just passes it back.
- `max_chars` is “characters of returned text/markdown”, post-extraction.

### Response shape

Always return an object:

```ts
{
  uri: string;
  content: string;            // the chunk
  truncated: boolean;         // whether there is more content
  next_cursor?: string;       // present when truncated=true

  // Helpful metadata (best-effort)
  content_type?: string;      // HTTP content-type or file mimeType
  kind?: "html" | "text" | "pdf" | "unknown";
  page_info?: {               // only when kind="pdf"
    page_start: number;
    page_end: number;
    total_pages: number;
  };
}
```

Backward compatibility:
- The tool currently returns a string. We’d be changing the tool output type.
- This is acceptable because the consumer is the LLM (not a strict client API),
  but we should ship an explicit tool instruction (below) so models use it correctly.

---

## Cursor semantics (single contract)

The cursor represents a position **in the extracted text stream**.

Implementation detail (opaque token):
- Encode as base64 JSON like:
  - `{ v: 1, kind: "pdf", page: 4 }`
  - `{ v: 1, kind: "html", char: 16000 }`
- This lets us evolve it.

Rules:
- `read(uri)` with no cursor returns the first chunk.
- If `truncated=true`, caller may request the next chunk by passing `next_cursor`.
- If `truncated=false`, there is no more content for this representation.

---

## Short-term cache (minutes)

We should add a small **in-memory cache** so pagination doesn’t re-fetch/re-parse the same resource.
This also helps agents that “continue reading” multiple times in a row.

### Scope

- **Short-lived**: TTL-based, e.g. 3–10 minutes.
- **In-memory only**: no persistence, no cross-process sharing.
- **Per runtime**: separate caches for Desktop renderer / Workbench / Mobile, etc.

### What to cache

Cache the **post-extraction text stream** that pagination operates on:
- HTML → Defuddle → markdown string
- Text/plain → string
- PDF → extracted text by page (array of page strings) or a single concatenated string

Optional (later):
- Cache raw bytes for PDFs if that significantly reduces repeated fetch cost.

### Keying / validation

Cache key should include:
- `uri`
- `kind` / representation (`html` vs `text` vs `pdf`)
- Best-effort validation fields when available:
  - `ETag` and/or `Last-Modified` for HTTP(S)
  - For `file:` URIs: `(hash or mutable id)` from CAS metadata

If validation fields change, treat it as a cache miss.

### Cursor integration

To avoid “cursor points into different content” bugs, include a cache reference in the cursor:
- Cursor JSON can include `cache_key` (or a short `cache_id`) plus the position.
- On `read` with a cursor:
  - If cache entry is missing/expired, restart from the beginning (and return chunk 1) OR return a clear “cursor expired” error.
  - Proposal preference: **restart from beginning** with a note in metadata (simpler for agents).

### Limits

Hard cap memory usage:
- Limit number of entries (e.g. 50) and/or total bytes (e.g. 5–20 MB).
- Use LRU eviction in addition to TTL.

---

## Source-specific behavior

### Web pages (HTML)

Pipeline stays the same:
1) fetch HTML
2) Defuddle → markdown (or text)
3) paginate the resulting string

Cursor can be a simple `char_offset` into the markdown string.

### Plain text

Return the first `max_chars` chars; cursor is `char_offset`.

### PDFs

PDFs paginate naturally by page, but we still expose the same contract.

Recommended cursor behavior for v1:
- Cursor is `{ page: number }`, not char offsets.
- Each `read` returns text for up to `N` pages (derived from `max_chars` heuristics)
  and sets `page_start/page_end` in `page_info`.

This gives stable pagination even if per-page extracted text varies.

Future optimization:
- Cache the parsed PDF per-agent/session (in memory) keyed by `(uri, etag/hash)`
  to avoid re-downloading/re-parsing for each page chunk.

---

## Limits and safety

We should enforce hard caps:
- `max_chars` max (e.g. 20k) regardless of request value.
- For PDFs: max bytes downloaded + max pages overall (we already have these).
- For web/text: max bytes downloaded during fetch (stream + abort when exceeded).

Errors should be explicit:
- If content is binary and not PDF: return the existing “read supports only text” error.
- If PDF header is invalid: return a “not a PDF / corrupted bytes” error.

---

## Tool instructions (for agents)

Add `toolRead.instructions` so `wrapChatAgentInstructions.ts` includes it.

Draft:
- “The `read` tool may return `truncated=true` with a `next_cursor`.”
- “To continue reading the same resource, call `read` again with the same `uri` and `cursor=next_cursor`.”
- “Stop when `truncated=false`.”
- “Prefer reading only as much as you need.”

---

## UX / product implications

This improves:
- reading large web pages without bloating context,
- reading long PDFs in chunks,
- consistent “continue reading” behavior.

We can optionally surface this in user docs (“How to use AI”) once implemented.

---

## Implementation sketch (no code)

1) Extend `toolRead.parameters` with `cursor` and `max_chars`.
2) Refactor `toolRead` to return a structured object.
3) Add a `paginateString(text, cursor, maxChars)` helper.
4) For PDFs, choose a cursor scheme (page-based v1).
5) Add a short-term in-memory cache (TTL + LRU) for extracted text streams.
6) Add `toolRead.instructions` describing pagination.

---

## Alternatives considered

- **New tool name (`read_page`)**: avoids output type change, but fragments usage.
- **Token-based limits**: closer to model reality, but requires tokenizer access.
- **Always page-based**: doesn’t map well to HTML/text.

