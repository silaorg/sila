# Cross-platform Hotkeys

Goal: one simple hotkey system that works in Electron menus and in the web build, and that users can change without restarting.

## Requirements
- Define hotkeys once and reuse them in renderer and main processes.
- Show them in Electron menus (`accelerator`) and trigger the same actions in the web app.
- Let users remap keys in the settings UI; persist per workspace/profile.
- Ship a sane default set: Cmd/Ctrl+N new conversation, Cmd/Ctrl+B toggle sidebar, Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Cmd/Ctrl+P quick switch, Cmd/Ctrl+K command palette, F1 help, Cmd/Ctrl+W close tab.
- Keep the implementation small: one registry, one IPC channel, one DOM listener.

## Design

### Single source of truth
- Create `packages/core/src/shortcuts/registry.ts` exporting a `ShortcutAction` list:
  - `id`, `label`, `description`, `scope` (`global` | `app` | `focused`), `default` combos per platform (`mac`, `win`, `linux`, `web`), optional `allowUnassigned`.
- Default combos live in code; user overrides live in settings (local file or space store) keyed by `actionId` → `binding` string.
- A helper `resolveShortcuts(platform, overrides)` returns the active map and flags conflicts.

### Renderer (web + Electron)
- Add `ShortcutService` (`packages/client/src/lib/shortcuts/service.ts`):
  - Loads defaults + overrides, exposes a Svelte store for UI, and emits `shortcutFired(actionId)`.
  - Attaches a single `keydown` listener that normalizes modifiers and compares against the active map; ignores input fields unless the action is marked `global`.
  - Persists overrides and debounces writes.

### Electron bridge
- `preload`: expose `getShortcuts`, `setShortcuts`, and `onMenuAction(actionId)` IPC wrappers.
- `main`: on app start, ask renderer for the active map; build the menu template with `accelerator` pulled from it. When renderer calls `setShortcuts`, rebuild the menu. Menu click sends `menu-action` with `actionId` back to renderer, so both menu selection and hotkey go through the same handler.
- Leave global shortcuts optional; we can add `globalShortcut.register` only for actions flagged `scope: "global"` later.

### Settings UI
- Add a simple picker component that listens for a key combo, validates, and calls `ShortcutService.update(actionId, binding)`.
- Show conflicts inline and prevent saving duplicates unless the user confirms replacing the existing binding.

## Flow
1. Renderer loads defaults + saved overrides → builds active map.
2. Renderer sends active map to main; main builds Electron menu accelerators.
3. User remaps a key; renderer updates map, persists, and re-sends to main; main rebuilds menu; DOM listener picks up the new binding instantly.
4. Web build uses the same renderer pieces minus the Electron IPC calls.

## Implementation steps
1. Add `registry.ts` with action definitions and helpers; add basic tests for normalization and conflict detection in `packages/core`.
2. Build `ShortcutService` with a single DOM listener and Svelte store; wire to command palette, quick switcher, sidebar toggle, undo/redo, tab close/new conversation.
3. Add Electron IPC handlers (`preload` + `main`) and update menu creation to read from the registry map.
4. Implement settings UI for remapping; persist to the existing settings store (or a new `shortcuts.json` under the workspace config if preferred).
5. Document the action list and default bindings in user-facing docs once stable.

## Notes and risks
- Use normalized strings (`CmdOrCtrl+N`, `Alt+Shift+N`) everywhere to avoid per-platform drift.
- Keep one listener to avoid duplicate triggers from components binding their own handlers.
- When a binding is cleared, remove the accelerator and hide it in the menu to avoid showing `Undefined`.
- Guard against system-reserved keys (e.g., Cmd+Q) and block them in the picker.
