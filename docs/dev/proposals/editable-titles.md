# Editable titles and unified rename

## Why
- Renaming uses different UIs: inline inputs in `packages/client/src/lib/comps/apps/files/FolderView.svelte`, a modal in `packages/client/src/lib/comps/spaces/SpaceList.svelte`, and a stub button in `packages/client/src/lib/comps/popups/AppTreeOptionsPopup.svelte`.
- Only the Files app handles `F2` today (inside its grid). Spaces and sidebar chats cannot respond.
- Each surface reimplements focus, Enter/Escape, blur handling, and styling for the edit state.
- We want any title to be editable while keeping the text styling, and a single `F2`/context-menu path to enter rename mode when a renamable item is selected.

## Goal
- One reusable “editable title” component that swaps a label for an input that inherits the label’s sizing/weight/spacing.
- One rename controller API so any view can expose its current selection as renamable, and GlobalKeyHandlers can trigger it on `F2` (plus context menus can call the same hook).
- Keep Escape/blur to cancel and Enter to commit everywhere; add optional validation for names (e.g., uniqueness in Files).

## Current behaviors to preserve
- Files: single selection + `F2` or context menu → inline rename; Enter commits, Escape/blur cancels; new folder auto-enters rename. Paths: `FolderView.svelte`, `FileItem.svelte`, `FolderItem.svelte`.
- Spaces: rename via modal from options menu; commits via button or Enter. Paths: `SpaceList.svelte`, `SpaceOptionsPopup.svelte`, `RenamingPopup.svelte`.
- Chats/files in sidebar: options menu shows “Rename” but is TODO. Paths: `AppTreeOptionsPopup.svelte`, `VertexItem.svelte`.

## Proposal
### 1) EditableTitle component
- Svelte component that renders a label by default and an `<input>` when `editing=true`.
- Accepts: `value`, `editing`, `placeholder`, `class` for the label, optional `inputClass`, callbacks `onCommit(value)`, `onCancel()`, `onStartEdit?()`.
- Input copies the label’s computed font size/weight/line-height and width so it visually matches the text it replaces.
- Default interactions: Enter commits trimmed value, Escape cancels, blur cancels (optionally commit-on-blur flag).
- Optional `validate(value)` to block commit and surface an inline error (for collisions in Files).
- Emits `startEdit()` helper to focus/select text; parent owns the editing state.

### Shortcut integration (use the current system)
- Renderer already normalizes shortcuts in `packages/client/src/lib/comps/GlobalKeyHandlers.svelte` and listens to Electron menu actions via `window.desktopMenu.onAction` (sent from `packages/desktop/src-electron/electronMenu.js` → `main-electron.js` IPC `sila:menu-action`).
- Add a `rename` action with default `F2` to the `bindings` map in `GlobalKeyHandlers` and route it to `renameController.startRename()` if present; keep the existing guard that ignores inputs/contenteditable.
- In `electronMenu.js`, add a menu item with accelerator `F2` that sends `rename` so native menus and keyboard reuse the same path.
- When the cross-platform shortcuts registry (see `docs/dev/proposals/shortcuts-in-electron.md`) lands, map `rename` there (e.g., `packages/core/src/shortcuts/registry.ts` + `packages/client/src/lib/shortcuts/shortcuts.ts`/service) and reuse its resolved binding instead of the inline map.

### 2) Rename controller API
- Add a lightweight registry in client state (e.g., `layout.renameController`) that holds the active “rename provider.”
- Provider shape: `{ id: string; label: string; startRename: () => void; cancelRename?: () => void; canRename?: () => boolean; priority?: number }`.
- Views register/unregister their provider on mount/unmount and update when selection changes. Only one active provider at a time (last writer wins unless priority overrides).
- GlobalKeyHandlers listens for `F2` and calls the current provider’s `startRename()` if `canRename !== false`. Electron menu (and context menus) can call the same API.

### 3) Apply to current surfaces
- Files app: replace inline inputs with `EditableTitle`; register the current single selection as the provider so `F2` works even when focus is elsewhere in the grid. Keep unique-name validation via `validate`.
- Spaces list: swap modal for inline `EditableTitle` inside the list row; register selected/hovered space when options menu opens so `F2` also works when row is focused.
- Sidebar chats/files: wire `AppTreeOptionsPopup` rename to toggle an `editing` flag on the title and commit via `ChatAppData.rename(newTitle)`; register the focused sidebar item as the provider.

### 4) Context menu wiring
- Context menu “Rename” buttons should call the provider’s `startRename()`; the Files grid keeps its existing menu but routes through the controller to stay consistent.
- Future menus (e.g., tab headers, file tree in editors) can reuse the same hook without re-adding shortcut logic.

### 5) Behavior and UX notes
- Keep Escape key global behavior: when editing, Escape cancels rename before bubbling to close overlays.
- Ensure `F2` is ignored when focus is already inside an input/textarea/contenteditable (same guard as existing GlobalKeyHandlers).
- Preserve accessibility: label still exposes text for screen readers; input includes `aria-label` mirroring the label text.
- Styling follows Skeleton tokens for colors; sizing is inherited from the surrounding label class to avoid bespoke font stacks.

## Open questions
- Should spaces keep a modal fallback for keyboard-only flows or use inline-only?
- Do we need debounce/auto-save for titles loaded from remote sync, or is immediate commit fine?
- How should we handle rename conflicts in Files (silent suffixing vs. inline error)?
