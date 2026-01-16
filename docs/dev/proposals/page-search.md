### Page Search in Chat View (Cross-Platform)

Goal: Add Cmd/Ctrl+F search inside the current chat view. Use the same UI and match-highlighting on desktop and mobile. Allow disabling it when the host browser provides a native page search UI we prefer.

---

## Scope and Principles

- Search only the active chat content. Do not search other chats.
- Highlight matches in-place and support next/previous navigation.
- Keep logic in the renderer so desktop and mobile can share it.
- Allow a platform flag to disable this and rely on native page search.

---

## UX

- Shortcut: `CmdOrCtrl+F` opens a small find bar in the chat view.
- Find bar fields: query input, next/prev buttons, match count, close button.
- Esc closes the find bar and clears highlights.
- When closed, remove all injected highlight markup.

Mobile:

- Add a search icon in the chat header to open the same find bar.
- Hide the shortcut hint on mobile.

---

## Architecture

### Renderer-only implementation (shared)

Add a small page search controller inside the chat view component.

1) Collect the container element that holds message content.
2) On query change, walk text nodes and wrap matches in `<mark data-chat-find>`.
3) Build a list of match elements for navigation.
4) Scroll to the active match and apply `data-chat-find-active`.
5) On close or query empty, unwrap all `<mark data-chat-find>` elements.

This avoids touching Markdown parsing and works on any platform that renders the chat UI.

### Platform gating

Add a platform flag or feature toggle:

- `pageSearch.enabled`: default true.
- `pageSearch.useNative`: if true, do not open our UI and defer to native search.

Examples:

- Desktop app: keep renderer search by default.
- Web build (if any): set `useNative` to true and let the browser handle it.
- Mobile: keep renderer search.

---

## Suggested API (Client State)

Expose a small controller via client state so the chat view can open/close it and the global shortcut can trigger it.

```ts
type PageSearchController = {
  open(): void;
  close(): void;
  toggle(): void;
  setQuery(value: string): void;
  next(): void;
  prev(): void;
};
```

The chat view registers the controller on mount and clears it on destroy.

---

## Implementation Notes

- Wrap only text nodes. Skip inputs, code blocks, and contenteditable nodes.
- Use case-insensitive match. Add a toggle for case-sensitive later if needed.
- Avoid regex for untrusted input. Use string search and manual slicing.
- Keep a cap on matches per update to avoid long pauses (e.g., 1000).
- Re-run highlights when messages change, but debounce.
- Remove highlights before rendering new ones to avoid nested marks.

---

## Files to Touch (Expected)

- `packages/client/src/lib/comps/apps/chat/ChatApp.svelte` (find bar + controller)
- `packages/client/src/lib/comps/GlobalKeyHandlers.svelte` (Cmd/Ctrl+F)
- `packages/client/src/lib/utils/pageSearch.ts` (DOM walker + highlight helpers)
- `packages/client/src/lib/state/clientStateContext` (controller storage)
- `packages/desktop/src-electron/electronMenu.js` (optional: menu item)

---

## Open Questions

- Should find include hidden "thinking" sections or only visible message text?
- Should match count include code blocks?
- Do we need a preference to always use native search on desktop?

---

## Rollout Plan

1) Ship renderer search with keyboard shortcut and basic UI.
2) Add next/prev navigation and match count.
3) Add feature flags for native search fallback.
4) Tune performance and edge cases (long chats, large code blocks).
