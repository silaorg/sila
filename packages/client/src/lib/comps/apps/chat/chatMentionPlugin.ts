import type { EditorView } from "prosemirror-view";
import { Plugin } from "prosemirror-state";

export type FileMention = {
  id: string;
  kind: "workspace-asset" | "chat-file";
  name: string;
};

type MentionHandlers = {
  open: (payload: { view: EditorView; pos: number }) => void;
  close: () => void;
  isOpen: () => boolean;
};

export function createFileMentionPlugin(handlers: MentionHandlers) {
    return new Plugin({
    props: {
        handleTextInput(view, _from, _to, text) {
        if (text === "@") {
            requestAnimationFrame(() => {
              const pos = view.state.selection.from;
              handlers.open({ view, pos });
            });
        }
        return false;
      },
      handleKeyDown(_view, event) {
        if (event.key === "Escape" && handlers.isOpen()) {
          handlers.close();
          return true;
        }
        return false;
      },
    },
  });
}

export function insertFileMention(
  view: EditorView,
  pos: number,
  file: FileMention
) {
  const mentionNode = view.state.schema.nodes.mention?.create({
    id: file.id,
    type: file.kind,
    label: file.name,
  });

  if (!mentionNode) return;

  const tr = view.state.tr
    .delete(pos - 1, pos)
    .insert(pos - 1, mentionNode)
    .scrollIntoView();

  view.dispatch(tr);
}
