# How we store links to workspace files

We store markdown links in our docs as `fref:` URIs that contain IDs of files rather than their paths so references survive renames/moves.
Example: `[Cool doc](fref:vertex123@tree456)`.

If we reference the file with the path `/docs/cool-doc.md` and then the user moves it to `/cool-docs/doc.md`, our chat messages that referenced the file will still reference it correctly. We would have ended up with a broken link if we saved paths.

## Storage format

- **Saved form**: `fref:{vertexId}@{treeId}`
  - `vertexId`: RepTree vertex id for the file vertex
  - `treeId`: the tree root id containing the vertex (space tree id or an app tree id)

## Display / editing / AI rules

- **Save-time (persisting message text)**: convert `file:` → `fref:`
  - Runs when creating a message (`ChatAppData.newMessage`) and when editing (`ChatAppData.editMessage`).
  - Also runs for assistant messages created via streaming (`WrapChatAgent` on finish).

- **Render-time (showing messages in chat)**: convert `fref:` → `file:`
  - Runs in the chat message components before passing markdown to the renderer.
  - This keeps markdown rendering simple: link/image components only need to understand `file:` (not `fref:`).

- **Edit-time (opening the editor UI)**: show `file:` in the editor
  - When the user clicks “Edit”, we prefill the editor with a `file:` version (not raw `fref:`).

- **AI-time (sending messages to the model)**: convert `fref:` → `file:`
  - Runs in `convertToLangMessage`.
  - This is a view transform only; it does not persist changes.

## Implementation entry points

- **Core transforms** (`packages/core/src/spaces/files/markdownFileRefs.ts`):
  - `transformPathsToFileReferences(markdown, ctx)`
  - `transformFileReferencesToPaths(markdown, ctx)`

We use Marked to tokenize markdown and locate link/image targets, then rewrite the original string via a small scanner that skips fenced code blocks and inline code.

## Resolution behavior (fref → file)

- If `fref:@treeId` can’t be resolved in that tree, we fallback to **workspace `assets/`** (only accept vertices under `assets`).
- If `fref:` has no `@treeId`, we try `candidateTreeIds` first, then fallback to workspace `assets/`.
- TODO: if not found in workspace assets, later we can also search in a trashbin.

## Known v1 limitations

- Only rewrites **inline** markdown links/images (`[text](target)` / `![alt](target)`), not reference-style links.
