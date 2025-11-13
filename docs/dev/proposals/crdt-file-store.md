## Proposal: CRDT‑backed File Store (Documents as CRDTs)

### Motivation

- **True collaborative editing**: Support concurrent human + agent edits to the same document with conflict‑free merges.
- **Local‑first**: Edits should work offline and reconcile deterministically when devices sync.
- **Efficient persistence**: Avoid rewriting whole documents; persist small, composable operations instead.

### Core Idea

Introduce a file store mode where a “document” is represented by an append‑only log of CRDT operations rather than a monolithic text blob. The system remains CRDT‑agnostic via a pluggable adapter (e.g., Yjs or other op‑based CRDTs). Reading produces the current materialized state by replaying ops (plus optional checkpoints). Writing translates text changes into CRDT ops, appended to the document’s log.

### What This Enables

- **Docs that feel like Google Docs/Notion** while remaining local‑first and agent‑friendly.
- **Concurrent edits** by multiple peers (people, agents, extensions) without manual conflict resolution.
- **Fine‑grained history** and potential time travel by replaying ops to any point.
- **Smaller writes** and better durability characteristics than large file overwrites.

### Principles

- **Adapter‑based**: The platform is CRDT‑agnostic; specific engines plug in behind a narrow interface.
- **Append‑only logs**: Operations are the source of truth; snapshots/checkpoints are optional accelerators.
- **Deterministic materialization**: Replaying the same ops yields the same state across peers.
- **Separation of concerns**: Structure/metadata stays in RepTree; doc content lives as CRDT ops in the file store.
- **Composability with Spaces**: Documents appear as normal files in the “Spaces as File Systems” VFS.

### Relationship to Existing Proposals

- **Spaces as File Systems**: CRDT documents surface as regular files in the VFS; reads/writes route through the CRDT adapter transparently.
- **ApplyPatch agent tooling**: Agent operations (List, Grep, Read, ApplyPatch) operate on space paths; reads materialize current state, writes become ops.
- **Update space structure & app instances**: Documents live alongside other app data; TreeSpecs inform how documents are referenced and discovered.

### Scope (Conceptual)

- A document type whose persistence is an op log, not a monolithic text.
- A standard interface for CRDT adapters to map “read/write text” to “apply/emit ops.”
- Optional checkpoints and compaction policies that do not alter the op‑log source of truth.

### Non‑Goals (for this proposal)

- No choice of a specific CRDT engine or wire format.
- No API signatures or storage layouts.
- No UI design for collaborative cursors, presence, or commenting.

### Open Questions (to address later)

- **Checkpoints**: How often to snapshot, and where to store them (per‑doc metadata)?
- **Search/indexing**: Do we index materialized text or ops? How to keep it incremental?
- **Binary embedding**: How do attachments within docs reference CAS assets safely?
- **Access control**: How do public/private visibility and per‑doc ACLs interact with op logs?
- **Back‑compat**: Migration strategy for existing plain‑text notes to CRDT docs and back.
- **Resource limits**: Compaction/GC strategies for long‑lived documents and heavy edit streams.

### Success Criteria (Conceptual)

- Multiple peers can edit the same document concurrently with predictable results.
- Documents behave like normal files in the VFS while preserving local‑first semantics.
- The platform remains CRDT‑agnostic and supports adding/removing adapters without data loss.


