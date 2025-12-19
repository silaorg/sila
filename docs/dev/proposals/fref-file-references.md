# Proposal: `fref:` (path-independent file references in markdown)

## Summary

We want markdown file links to **survive file moves/renames**. Today, markdown commonly contains logical “file URIs” like `file:///assets/foo.md` (workspace) or `file:notes.md` (chat). Those are path-based, so moving the underlying file breaks the reference.

This proposal introduces a new URI scheme:

- `fref:{vertexId}@{treeId}` where `treeId` is optional

and two small transforms:

- `transformPathsToFileReferences(markdown, ctx)` — run when **saving** markdown
- `transformFileReferencesToPaths(markdown, ctx)` — run when **displaying** markdown to **users and AI**

The implementation should reuse existing Sila primitives:

- **Stable IDs**: files are vertices in RepTree; vertex IDs are stable across renames/moves within a tree.
- **Existing file path ↔ vertex mapping**: `FileResolver.pathToVertex(...)` and `FileResolver.vertexToPath(...)`.
- **Existing “file reference” concept**: Sila already uses `{tree, vertex}` in attachments (`packages/core/src/spaces/files/FileResolver.ts`).

## Current model (as implemented today)

### Files are vertices in trees

Sila stores “files” as vertices with file metadata (e.g. `mimeType`, `hash`/`id`, `size`) inside RepTree trees:

- **Workspace files** live in the **space tree** under `assets/...` (created by `Space.newSpace`, which creates an `assets` vertex).
- **Chat-scoped files** live in a **chat app tree** under `assets/...` (see `ChatAppData.ASSETS_ROOT_PATH = "assets"`).

### Markdown uses logical file URIs

Sila uses logical file URI strings in multiple places:

- Workspace: `file:///assets/...` (anchored at `Space.rootVertex`)
- Chat: `file:...` (anchored at the chat’s `assets` root vertex)

`FileResolver.pathToVertex(...)` supports both:

- Workspace: parses `file:///...` and resolves from the space root.
- Chat: parses `file:...` and resolves relative to a provided `relativeRootVertex` (typically the chat’s assets root).

### Attachments already use stable references

Attachments on messages are stored as:

```ts
interface FileReference {
  tree: string;   // tree root id (AppTree.getId())
  vertex: string; // vertex id inside that tree
}
```

and are resolved via `FileResolver.resolveFileReference(...)` / `getFileData(...)`.

This proposal extends that stable-reference approach to **markdown link targets**, not just attachments.

## Goals

- **Stable references**: moving/renaming a file should not break the link.
- **Human-friendly display / AI-friendly context**: when rendering markdown for the user (and when sending to the model), `fref:` should resolve back to a path-based `file:` / `file:///` URI.
- **Simple implementation**: minimal new types, reuse `FileResolver`, avoid deep refactors.
- **Self-healing**: if `treeId` is missing (or stale), optionally search “reasonable” trees and rewrite to `@{resolvedTreeId}` when a match is found.

## Non-goals (v1)

- Lossless markdown formatting round-trip for all edge cases (reference-style links, nested parentheses, etc.).
- Global, cross-space references.
- Referencing “by hash” (content-addressed) for move/rename resilience; we want identity-by-vertex first.

## Proposal

### 1) Introduce `fref:` URI scheme

**Format**

- `fref:{vertexId}@{treeId}` — explicit tree
- `fref:{vertexId}` — tree omitted (resolver will search)

**Definitions**

- `vertexId`: the RepTree vertex ID for the file vertex.
- `treeId`: the RepTree root vertex ID for the tree that contains the vertex.
  - For an app tree, this is `AppTree.getId()`.
  - For the space tree, this is `Space.getId()` (same as `space.tree.root.id`).

**Example**

AI output (path-based):

`[text file](file:///assets/text-file.md)`

Saved form (stable):

`[text file](fref:uuid-vertex@uuid-space)`

### 2) Add two transforms

#### `transformPathsToFileReferences(markdown, ctx)`

**Purpose**

Convert path-based file links to stable `fref:` links at save time.

**Input**

Markdown containing links/images. Targets may include:

- `file:///...` (workspace)
- `file:...` (chat-relative)

**Algorithm (per link/image target)**

1. If the `href` does not start with `file:`, do nothing.
2. Resolve to a vertex using existing logic:
   - Workspace paths: `fileResolver.pathToVertex(href)`
   - Chat paths: `fileResolver.pathToVertex(href, chatAssetsRootVertex)`
3. If resolution succeeds:
   - Let `vertexId = vertex.id`
   - Let `treeId = vertex.tree.root.id`
   - Rewrite `href` to `fref:${vertexId}@${treeId}` (recommend: **always include `@treeId`** when saving)
4. If resolution fails, leave the link unchanged (don’t introduce broken refs during save).

**Context (`ctx`)**

- `spaceId: string` (for convenience; equals `Space.getId()`)
- `fileResolver: FileResolver`
- Optional `chatAssetsRootVertex?: Vertex` (or some equivalent chat context)

#### `transformFileReferencesToPaths(markdown, ctx)`

**Purpose**

Convert stable `fref:` links back to current file paths (for user display and AI context).

**Algorithm (per link/image target)**

1. If `href` does not start with `fref:`, do nothing.
2. Parse:
   - `vertexId`
   - optional `treeId`
3. Resolve:
   - If `treeId` is provided:
     - If `treeId === spaceId`: resolve `vertex = space.getVertex(vertexId)`
     - Else: `appTree = await space.loadAppTree(treeId)` then `vertex = appTree.tree.getVertex(vertexId)`
   - If `treeId` is missing:
     - Search in “reasonable” trees (see below)
4. If found:
   - Rewrite `href` to `fileResolver.vertexToPath(vertex)` (produces `file:///...` or `file:...` depending on the vertex’s tree).
   - Optional self-heal: if `treeId` was missing or wrong, you may also rewrite the stored fref to include `@{resolvedTreeId}` (see “Self-healing”).
5. If not found:
   - Leave as `fref:` and/or allow UI to show a “missing file” state (prefer UI decoration over corrupting markdown).

**“Reasonable tree search”**

To keep this deterministic and easy to implement, the caller provides the search order:

- `candidateTreeIds: string[]` (ordered)
  - Example order for chat message rendering:
    - current chat tree id
    - space id (workspace)
    - other loaded app tree ids (optional)

If multiple matches occur (unlikely but possible), pick the first match by this ordering.

### 3) Self-healing behavior (tree-id optional)

We want the optional tree-id to be useful but not required.

**Policy (v1)**

- When saving `file:` links → always produce `fref:vertex@tree` (explicit).
- When encountering `fref:vertex` (no `@tree`) at display/AI time:
  - Resolve using `candidateTreeIds` search order.
  - If found, rewrite the *displayed* link target to a path.
  - Optionally return `didHealRefs` + a “healed markdown” string so the caller can persist the updated `@treeId` later (on next save).

This keeps the system stable and avoids background writes in rendering code.

## Integration points (minimal)

### Save-time (path → fref)

Wherever markdown is persisted to a RepTree vertex property, run:

- `transformPathsToFileReferences(...)` before persisting `text`.

Likely candidates:

- Chat message creation from assistant output (where message text is stored).
- Message edit flow (user edits markdown).
- Any other feature that stores markdown blobs.

### Display-time (fref → path)

Wherever markdown is rendered for users, run:

- `transformFileReferencesToPaths(...)` before passing the markdown string to the renderer.

This avoids modifying the markdown renderer and keeps `MarkdownLink.svelte` / `FileMentionInAMessage.svelte` working unchanged (they already treat `file:` links specially).

### AI-time (fref → path)

Before sending message text to the model (e.g., in `convertToLangMessage`), run:

- `transformFileReferencesToPaths(...)`

so the model continues to see familiar `file:` / `file:///` URIs.

## Implementation sketch (simple + aligned with current code)

### New helpers (core)

Add a small module in `packages/core/src/spaces/files/`:

- `fref.ts`
  - `parseFrefUri(uri: string): { vertexId: string; treeId?: string } | null`
  - `formatFrefUri(vertexId: string, treeId?: string): string`

- `markdownFileRefs.ts`
  - `transformPathsToFileReferences(markdown: string, ctx: ...) => Promise<string>`
  - `transformFileReferencesToPaths(markdown: string, ctx: ...) => Promise<{ markdown: string; didHealRefs: boolean }>`

### Parsing markdown links

Keep it pragmatic:

- Focus on inline links and images: `[text](target "title")`, `![alt](target)`
- Ignore code blocks/inline code (best handled by a markdown tokenizer, not regex)

If we want the simplest robust approach, use a markdown tokenizer already in the stack:

- Client uses `@markpage/svelte` (Marked-based).
- Some components import `Tokens` from `"marked"`, indicating Marked is already present in the dependency graph.

We can choose either:

- **Option A (easy, “good enough” for AI-generated markdown):** a careful link scanner that only rewrites `(...)` targets for markdown links/images.
- **Option B (more robust):** use a markdown tokenizer (Marked) to find link/image tokens and then rewrite the original string via a link-target replacer (requires either token offsets or a secondary scanning pass).

V1 recommendation: start with Option A; upgrade later if needed.

## Open questions

1. **Should `fref:` be allowed to reference the space tree?**
   - This proposal says yes (treeId = `Space.getId()`), but `FileResolver.resolveFileReference(...)` currently loads via `loadAppTree`, which doesn’t cover the space tree. That’s fine: the markdown transforms can resolve space-tree vertices directly via `space.getVertex(...)`.
2. **Where do we store “healed” refs?**
   - Recommendation: return a `didHealRefs` flag and let the caller decide when to persist the healed markdown (e.g., on next explicit save).
3. **Do we want to expose `fref:` to the user?**
   - This proposal assumes `fref:` is primarily a storage format; UI/AI see paths.

## Acceptance criteria

- Saving markdown with `file:` / `file:///` links produces `fref:` links when the target resolves.
- Rendering markdown with `fref:` links resolves back to correct `file:` / `file:///` paths when possible.
- Moving/renaming a file within the same tree does not break an `fref:` link.
- Unknown/unresolvable `fref:` links fail gracefully (no crash; UI can show “missing”).


