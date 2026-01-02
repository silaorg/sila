# Attach Workspace Files from SendMessageForm

Add ability to attach workspace assets to messages as file references (like `@` mentions). Users browse and select existing files, attach them as references without loading bytes.

## Current State

- Files attach via upload (creates new files) or clipboard paste
- Workspace files exist as vertices in `/assets` folder
- `FilesApp` component exists for browsing files
- File mentions via `@` insert paths into message text
- `newMessage()` accepts `AttachmentPreview[]` (uploads) but not `FileReference[]` (existing files)

## Approach

Reuse `FilesApp` in a swin modal. User clicks "Browse workspace", opens modal, selects file, attaches it as a `FileReference`.

**Steps:**
1. Add "Browse workspace" button to attachments menu
2. Create `FilePickerSwin` component (swin wrapper around `FilesApp`)
3. Show `FilesApp` scoped to workspace assets (`/assets` vertex)
4. Convert selected vertex to `FileReference`: `{ tree: treeId, vertex: vertexId }`
5. Extend `newMessage()` to accept `FileReference[]` (in addition to `AttachmentPreview[]`)
6. Store `FileReference[]` directly in message properties (no file loading needed)

**Reference creation:**
- For workspace assets: `{ tree: space.getId(), vertex: vertex.id }`
- Get tree ID from `vertex.tree.root?.id` or `space.getId()`
- Get vertex ID from `vertex.id`

**Pros:** No file loading, lightweight, reuses existing files, matches `@` mention pattern.

**Cons:** Requires modal, need to extend `newMessage()` API.

## Implementation

**New files:**
- `packages/client/src/lib/swins/routes/FilePickerSwin.svelte`

**Modified files:**
- `packages/client/src/lib/state/swinsLayout.ts` - add `filePicker` entry
- `packages/client/src/lib/comps/forms/SendMessageForm.svelte` - add button, handle file reference callback
- `packages/core/src/spaces/ChatAppData.ts` - extend `newMessage()` to accept `FileReference[]` alongside `AttachmentPreview[]`

**API change:**
```typescript
async newMessage(message: {
  attachments?: Array<AttachmentPreview>;
  fileRefs?: Array<FileReference>; // NEW: for existing workspace files
  // ... rest
})
```

If `fileRefs` provided, append to `properties.files` array directly (no CAS operations needed).
