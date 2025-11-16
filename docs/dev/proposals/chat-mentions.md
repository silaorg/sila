## Chat Mentions with ProseMirror

### Why
The current `ChatAppMessageEditForm.svelte` textarea cannot detect `@` or render inline UI. Swapping it for a minimal ProseMirror setup gives us structured text, extensible key handling, and reusable plugins we can later drop into long-form document editing.

### Plan
1. **Embed a tiny editor view** – replace the `<textarea>` with a `<div bind:this={editorHost}>` and initialize a `EditorView` on mount. Keep the model as plain text for now; we only need the `doc` node plus `text`.
2. **Add a mention plugin** – watch transactions for the `@` character, capture the current position, and open a floating suggestion panel. When the user picks a person, dispatch a transaction that inserts an inline atom with attrs `{ id, label }` plus a `toDOM` render hook.
3. **Expose the value** – listen to `view.state.doc.textContent` for `onSave`, and destroy the view on unmount so it stays lightweight.
4. **Reuse infra** – the same schema + plugin works for future document editors; we just add marks/nodes, but the mention extension stays identical.

### Sketch

```svelte
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorState } from "prosemirror-state";
  import { EditorView } from "prosemirror-view";
  import { schema } from "./chatSchema";
  import { mentionPlugin } from "./mentionPlugin";

  export let initialValue = "";
  export let onSave: (text: string) => void;
  let view: EditorView;
  let host: HTMLDivElement;

  onMount(() => {
    view = new EditorView(host, {
      state: EditorState.create({
        schema,
        doc: schema.node("doc", null, schema.text(initialValue)),
        plugins: [mentionPlugin()],
      }),
      dispatchTransaction(tr) {
        view.updateState(view.state.apply(tr));
      },
    });
  });

  onDestroy(() => view?.destroy());
</script>

<div class="chat-editor" bind:this={host} />
<button on:click={() => onSave(view.state.doc.textContent)}>Send</button>
```

```ts
// mentionPlugin.ts
export function mentionPlugin() {
  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (text === "@") openMentionMenu(view, from);
        return false;
      },
    },
    view(view) {
      return {
        update(view, prevState) {
          MaybeCloseMenu(view, prevState);
        },
        destroy() {
          closeMenu();
        },
      };
    },
  });
}
```

`openMentionMenu` can emit a `CustomEvent` to Svelte to render a Tailwind popover. Selecting a user calls `insertMention(view, pos, user)` which dispatches a single transaction:

```ts
function insertMention(view, pos, user) {
  view.dispatch(
    view.state.tr
      .delete(pos - 1, pos) // remove "@"
      .insert(
        pos - 1,
        view.state.schema.nodes.mention.create({ id: user.id, label: user.name })
      )
      .scrollIntoView()
  );
}
```

### Future-ready
- Mentions become an inline node, so any ProseMirror surface (chat, notes, docs) can share the same schema + plugin.
- To enable document editing later, extend the schema with marks (bold, link, code) and add toolbar plugins; the mention implementation stays untouched.

With this plan we only add ~40 lines inside `ChatAppMessageEditForm.svelte`, gain structured input, and unlock a path toward full ProseMirror-powered editors.
