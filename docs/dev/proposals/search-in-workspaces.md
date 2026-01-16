### Hybrid Search in Sila Workspaces (BM25 + Embeddings)

Goal: Ship a simple, environment-agnostic hybrid search that runs locally and on servers, indexing workspace content (chats, files, etc.) and storing indices inside each workspace. Start small, keep flexible, and upgradeable.

---

## Scope and Principles

- Keep indices local-first, per workspace.
- Use simple, proven pieces: BM25 for lexical; embeddings for semantic; MMR for diversity; optional reranker.
- Work in browser and Node/Electron; degrade gracefully if some models aren’t available.
- Store indices alongside the workspace using our existing file system abstraction. SQLite is optional.
- Allow a local backend on desktop/mobile so the UI only calls a search API.

---

## Data Model

Everything is a resource with 0..N chunks (singletons have one chunk).

```ts
interface Resource {
  rid: string;                 // e.g., "@docs/features.md", "@app/chat/123/msg/456"
  title?: string;
  lang?: string;               // ISO code
  workspace?: string;          // tenant/org (space id)
  visibility?: string[];       // ACL principals/roles
  createdAt?: string;          // ISO
  updatedAt?: string;          // ISO
  chunks: Chunk[];
}

interface Chunk {
  cid: string;                 // chunk id within resource
  text: string;                // display text (raw or lightly cleaned)
  normText?: string;           // normalized for BM25
  headingPath?: string[];      // ["Features", "Inference"]
  startChar?: number;          // optional offsets
  endChar?: number;
  vector?: number[];           // embedding vector
}
```

Index manifest (recommended):

```json
{
  "schemaVersion": "1.0",
  "model": { "name": "EmbeddingGemma", "dim": 1024, "normalize": true },
  "preprocessing": { "chunkSize": 512, "overlap": 64 },
  "createdAt": "2025-09-27T00:00:00Z"
}
```

---

## Architecture (UI + local backend)

We can split search into a thin UI client and a local backend that owns indexing and storage.

- Desktop: Electron main process runs the backend.
- Mobile: a Capacitor plugin (native module) or a background JS service runs the backend.
- Server: same API, per-workspace store.

The UI calls the backend via a small RPC interface:

- `search.query(workspaceId, query, filters)`
- `search.reindex(workspaceId, { force })`
- `search.status(workspaceId)`

This keeps large indices off the UI memory while keeping local-first behavior.

### Mobile notes

We can support two mobile paths:

1) **Capacitor native plugin**
   - Runs in native layer.
   - Owns the index and storage (SQLite if available).
   - Exposes the same RPC interface to the Svelte UI.

2) **Background JS service**
   - Runs in the web layer but off the main UI thread (worker or hidden webview).
   - Uses `AppFileSystem` + JSONL.
   - Keeps dependencies minimal, but still bounded by mobile memory.

Start with JSONL + JS service for simplicity, then add the native plugin when needed.

## Storage Layout in a Workspace

For local file-based workspaces (synced via Dropbox/iCloud, etc.), store the search index outside the workspace to avoid sync conflicts. Keep it in app-local data, keyed by workspace id or path.

For server workspaces, store the index with the workspace on the server.

Base path: `<spaceRoot>/space-v1/search/`.

- `<spaceRoot>/space-v1/search/manifest.json` – index metadata
- `<spaceRoot>/space-v1/search/bm25.jsonl` – BM25 corpus (portable JSONL)
- `<spaceRoot>/space-v1/search/vectors.jsonl` – `{ id, vector }` for small corpora
- `<spaceRoot>/space-v1/search/index.sqlite` – optional SQLite index (desktop/mobile backend)

Why dual formats? Simplicity and portability. JSONL is trivial and browser-friendly; SQLite gives transactional upserts, secondary indexes, and faster lookups on desktop/mobile.

### SQLite Schema (optional but recommended)

```sql
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,       -- rid:cid
  rid TEXT NOT NULL,
  cid TEXT NOT NULL,
  title TEXT,
  lang TEXT,
  visibility TEXT,           -- JSON array string
  created_at TEXT,
  updated_at TEXT,
  heading_path TEXT,         -- JSON array string
  start_char INTEGER,
  end_char INTEGER,
  text TEXT NOT NULL,
  norm_text TEXT             -- for BM25
);

CREATE TABLE IF NOT EXISTS vectors (
  id TEXT PRIMARY KEY,       -- rid:cid
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL       -- Float32Array bytes
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_rid ON chunks(rid);
CREATE INDEX IF NOT EXISTS idx_chunks_lang ON chunks(lang);
```

Notes:
- BM25 itself is kept in-memory at runtime via a JS library; we persist inputs (`norm_text`) plus a serialized snapshot if supported by the BM25 library. JSONL remains the fallback persistence.
- Vectors use raw Float32 in SQLite BLOBs for speed and minimal overhead.

---

## Libraries (browser + Node compatible)

- BM25 / lexical: `wink-bm25-text-search`
- Embeddings: provider API or local via `transformers.js`
- Vector store / ANN: `vectordb` (in-memory) for MVP; upgrade to `hnswlib-node` for Node-only heavy sets
- Reranker (optional): `transformers.js` cross-encoder (MiniLM-size)

---

## Indexing Pipeline (build-time or background task)

1) Ingest resources (docs, chats, code) → chunk (~512 tokens, 64 overlap)
2) Normalize text for BM25; keep raw `text` for display
3) BM25: add each chunk as a document (use `normText`)
4) Embeddings: embed `text`; store `vector`
5) Vector store: upsert `{ id: rid:cid, vector }` into in-memory ANN and persist to SQLite/JSONL
6) Metadata: persist `rid`, `cid`, `headingPath`, `lang`, `visibility` for filtering and boosts

Chunking rules per content type:
- Chats: chunk per message or message windows; store author/time for boosts
- Markdown/files: heading-aware chunker; keep `headingPath`
- Code: consider lightweight splitter (function-level) later; out of MVP if noisy

---

## Query Flow (runtime)

1) Preprocess query: normalize; parse filters (workspace/ACL/lang/path prefixes)
2) BM25 stage: search normalized query → top K1 (e.g., 200)
3) Semantic stage: embed query → ANN search → top K2 (e.g., 200; cosine)
4) Merge candidates: Reciprocal Rank Fusion (RRF) or weighted sum
5) Filter by ACLs/tenant before expensive steps (prevent leakage)
6) Diversify with MMR (λ≈0.7) to reduce near-duplicates
7) Optional rerank: cross-encoder on top ~50, return top 10–20
8) Field boosts: title/heading matches, recency decay, author affinity for chats
9) Assemble results: group by `rid`, collapse adjacent chunks, highlight terms

Scoring recipes:
- RRF: `rrf = 1/(k + rank)`; final = sum(rrf_bm25, rrf_sem)
- Weighted: `final = α*bm25_norm + (1-α)*cosine_norm` (α ≈ 0.4–0.6)

MMR pseudocode:

```js
function mmr(queryVec, candidates, lambda = 0.7, topK = 10) {
  const selected = [];
  const remaining = [...candidates];
  while (selected.length < topK && remaining.length) {
    let best = null, bestScore = -Infinity;
    for (const cand of remaining) {
      const rel = cosineSim(queryVec, cand.vector);
      const div = selected.length ? Math.max(...selected.map(s => cosineSim(cand.vector, s.vector))) : 0;
      const score = lambda * rel - (1 - lambda) * div;
      if (score > bestScore) { best = cand; bestScore = score; }
    }
    selected.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return selected;
}
```

---

## Integration with Sila Workspace FS

Use `AppFileSystem` to read/write under `<spaceRoot>/space-v1/search/` so the same code works in browser (IndexedDB-backed), desktop (Electron FS), and mobile.

If a local backend exists, keep the index logic there and expose a small API to the UI.

- Creation: ensure `search/` dir and `manifest.json` exist
- Writes: JSONL and SQLite writes go through FS abstraction; for SQLite, use embedded DB when available, otherwise JSONL-only mode
- Updates: reindex can be incremental by observing chat/file ops and updating affected resources

Path conventions:
- BM25 corpus: `bm25.jsonl` with `{ id, normText, meta }` lines
- Vectors: `vectors.jsonl` with `{ id, vector }` (base64 Float32) if SQLite not present
- SQLite: `index.sqlite` (tables above); BM25 inputs kept in `chunks.norm_text`

---

## Security & Privacy

- Enforce ACL filtering in both BM25 and ANN candidate generation
- Avoid sending private chunks to external rerankers unless allowed by settings
- Keep indices local to the workspace; user can delete `search/` to drop the index

---

## Performance Notes

- Start with in-memory ANN and JSONL persistence; load on app open
- For large corpora on desktop, prefer SQLite + `hnswlib-node` in a worker
- Cache query embeddings and hot ANN results; keep Float32 vectors; consider FP16 server-side if needed

---

## Minimal Implementation Checklist

- [ ] Build chunker (token ~512, overlap ~64) for chats and markdown/files
- [ ] Normalize text for BM25; keep raw text for display
- [ ] Create BM25 index with `wink-bm25-text-search`
- [ ] Compute and store embeddings per chunk
- [ ] Create ANN index (`vectordb`) with `{ id, vector }`
- [ ] Persist indices: JSONL always; SQLite when available
- [ ] Implement hybrid merge (RRF or weighted)
- [ ] Implement MMR diversification (λ≈0.7)
- [ ] (Optional) Add cross-encoder reranker via `transformers.js`
- [ ] Field boosts (headings, recency, author affinity)
- [ ] Enforce ACL filters before rerank
- [ ] Results assembly (group by `rid`, collapse adjacent chunks, highlights)

---

## Rollout Plan

MVP:
- Chats + markdown files; JSONL persistence; in-memory ANN; no reranker
- Desktop and browser support; rebuild index on demand; incremental updates for new chats

Phase 2:
- SQLite persistence on desktop; HNSW index (`hnswlib-node`) in worker
- Cross-encoder reranker optional; heading-aware chunker for markdown

Phase 3:
- Advanced boosts, snapshots of indices, background compaction
- Code and PDF ingestion with parsers; multilingual models

---

## Open Questions

- Embedding provider defaults and rate limits
- Index size quotas per workspace; cleanup policies
- Cross-space/global search UX and opt-in
