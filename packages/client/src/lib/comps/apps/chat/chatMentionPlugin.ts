import type { EditorView } from "prosemirror-view";
import { Plugin, type EditorState } from "prosemirror-state";

export type FileMention = {
  id: string;
  kind: "workspace-asset" | "chat-file";
  name: string;
};

type MentionHandlers = {
  open: (payload: {
    view: EditorView;
    anchorPos: number;
    insertPos: number;
  }) => void;
  close: () => void;
  isOpen: () => boolean;
};

type MentionContext = {
  head: number;
  triggerPos: number;
  query: string;
};

const LOOKBACK_LIMIT = 80;

function getTextSlice(
  state: EditorState,
  from: number,
  to: number
): string {
  const start = Math.max(0, Math.min(from, state.doc.content.size));
  const end = Math.max(0, Math.min(to, state.doc.content.size));
  if (end <= start) return "";
  return state.doc.textBetween(start, end, "\n", "\n");
}

function isBoundaryChar(char: string): boolean {
  return char === "" || /\s/.test(char);
}

function isValidMentionQuery(query: string): boolean {
  if (query === "") return true;
  if (query.includes("\n") || query.includes("\t")) return false;
  if (query.includes("  ")) return false;
  const spaceCount = (query.match(/ /g) ?? []).length;
  if (spaceCount > 1) return false;
  if (spaceCount === 1 && query.replace(/ /g, "").length === 0) return false;
  return true;
}

function getMentionContext(state: EditorState): MentionContext | null {
  const head = state.selection.from;
  const charAtHead = getTextSlice(state, head, head + 1);

  if (charAtHead === "@") {
    const before = getTextSlice(state, head - 1, head);
    if (!isBoundaryChar(before)) return null;
    return { head, triggerPos: head, query: "" };
  }

  const start = Math.max(0, head - LOOKBACK_LIMIT);
  const chunk = state.doc.textBetween(start, head, "\n", "\n");
  const relIndex = chunk.lastIndexOf("@");
  if (relIndex === -1) return null;

  const triggerPos = start + relIndex;
  const beforeTrigger = getTextSlice(state, triggerPos - 1, triggerPos);
  if (!isBoundaryChar(beforeTrigger)) return null;

  const query = getTextSlice(state, triggerPos + 1, head);
  if (!isValidMentionQuery(query)) return null;

  return { head, triggerPos, query };
}

function schedule(fn: () => void) {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(fn);
  } else {
    setTimeout(fn, 0);
  }
}

export function createFileMentionPlugin(handlers: MentionHandlers) {
  let lastContextKey: string | null = null;

  function syncFromState(view: EditorView) {
    const context = getMentionContext(view.state);
    if (!context) {
      if (handlers.isOpen()) {
        handlers.close();
      }
      lastContextKey = null;
      return;
    }

    const key = `${context.triggerPos}:${context.head}:${context.query}`;
    if (!handlers.isOpen() || key !== lastContextKey) {
      const insertPos =
        context.head >= context.triggerPos
          ? context.head
          : context.triggerPos + 1;
      handlers.open({
        view,
        anchorPos: context.head,
        insertPos,
      });
    }
    lastContextKey = key;
  }

  function deferSync(view: EditorView) {
    schedule(() => syncFromState(view));
  }

    return new Plugin({
    props: {
      handleTextInput(view) {
        deferSync(view);
        return false;
      },
      handleKeyDown(view, event) {
        if (event.key === "Escape" && handlers.isOpen()) {
          handlers.close();
          lastContextKey = null;
          return true;
        }
        deferSync(view);
        return false;
      },
      handleClick(view) {
        deferSync(view);
        return false;
      },
    },
    view(view) {
      return {
        update(updatedView, prevState) {
          if (
            !prevState.doc.eq(updatedView.state.doc) ||
            !prevState.selection.eq(updatedView.state.selection)
          ) {
            deferSync(updatedView);
          }
        },
        destroy() {
          lastContextKey = null;
        },
      };
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
