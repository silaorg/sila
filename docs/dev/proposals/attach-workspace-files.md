# Attach Workspace Files from SendMessageForm

Add ability to insert workspace file mentions into editor text via file browser. Works exactly like `@` mentions (inserts text links), but with different UI - user browses files instead of typing `@filename`.

## Current State

- File mentions via `@` insert text links into message text (using `insertFileMention`)
- Workspace files exist as vertices in `/assets` folder
- `FilesApp` component exists for browsing files
- `ChatEditor` has `insertFileMention` function that inserts file mention nodes into editor

## Approach

Reuse `FilesApp` in a swin modal. User clicks "Browse workspace", opens modal, selects file. Insert file mention into editor text using same `insertFileMention` function as `@` mentions.

**Steps:**
1. Add "Browse workspace" button to attachments menu (or editor toolbar)
2. Create `FilePickerSwin` component (swin wrapper around `FilesApp`)
3. Show `FilesApp` scoped to workspace assets (`/assets` vertex)
4. Convert selected vertex to `FileMention`: `{ path: "file:///assets/filename", name: "filename" }`
5. Call `insertFileMention` on editor to insert file mention (same as `@` mentions)

**FileMention creation:**
- Use `FileResolver.vertexToPath(vertex)` to get path like `"file:///assets/filename"`
- Use `vertex.name` for the display name
- Creates same `FileMention` object that `@` mentions use

**Pros:** Reuses existing mention infrastructure, no API changes, works exactly like `@` mentions. Different UI (browse vs type) but same result.

**Cons:** Requires modal, need access to editor instance from `SendMessageForm`.

## Implementation

**New files:**
- `packages/client/src/lib/swins/routes/FilePickerSwin.svelte`

**Modified files:**
- `packages/client/src/lib/state/swinsLayout.ts` - add `filePicker` entry
- `packages/client/src/lib/comps/forms/SendMessageForm.svelte` - add button, get editor ref, call `insertFileMention`
- `packages/client/src/lib/comps/apps/chat/ChatEditor.svelte` - expose `insertFileMention` function or editor view instance

**Key:**
- Get editor view instance from `ChatEditor` 
- Use `insertFileMention(view, currentCursorPos, fileMention)` to insert
- Same function used by `@` mention menu
