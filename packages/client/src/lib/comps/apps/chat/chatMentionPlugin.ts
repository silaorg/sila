// ProseMirror plugin for detecting `@file`-style mentions in the chat editor.
// - Tracks the current `@` + query range near the cursor
// - Notifies the UI when a mention context opens/closes or changes
// - Provides `insertFileMention` to replace the typed `@query` with an inline mention node

import type { EditorView } from "prosemirror-view";
import { Plugin, type EditorState } from "prosemirror-state";

export type FileMention = {
  path: string; // "file:///assets/pic.jpg" for workspace, "file:pic.jpg" for chat
  name: string;
};

type MentionHandlers = {
  open: (payload: {
    view: EditorView;
    anchorPos: number;
    insertPos: number;
    query: string;
  }) => void;
  close: () => void;
  isOpen: () => boolean;
};

type MentionContext = {
  head: number;
  triggerPos: number;
  query: string;
};

// Max number of characters to look back from the cursor when searching for a `@` trigger
const LOOKBACK_LIMIT = 80;

// Safely reads a text slice between positions, clamped to the document size.
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

// Word boundary characters that allow a mention trigger to start
function isBoundaryChar(char: string): boolean {
  return char === "" || /\s/.test(char);
}

// Basic validation for the text typed after `@` that should count as a mention query
function isValidMentionQuery(query: string): boolean {
  if (query === "") return true;
  if (query.includes("\n") || query.includes("\t")) return false;
  if (query.includes("  ")) return false;
  const spaceCount = (query.match(/ /g) ?? []).length;
  if (spaceCount > 1) return false;
  if (spaceCount === 1 && query.replace(/ /g, "").length === 0) return false;
  return true;
}

// Returns the current mention context (`@` position, head, query) if the cursor is inside one.
// Otherwise returns null, meaning the mention menu should be closed.
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

// Small helper to defer sync work to the next frame
function schedule(fn: () => void) {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(fn);
  } else {
    setTimeout(fn, 0);
  }
}

export function createFileMentionPlugin(handlers: MentionHandlers) {
  let lastContextKey: string | null = null;

  // Computes the latest mention context from editor state and calls handlers accordingly.
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
        query: context.query,
      });
    }
    lastContextKey = key;
  }

  function deferSync(view: EditorView) {
    schedule(() => syncFromState(view));
  }

  // Core ProseMirror plugin that watches text / selection changes and drives the mention menu.
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
  const { state } = view;
  const mentionNode = state.schema.nodes.mention?.create({
    path: file.path,
    label: file.name,
  });

  if (!mentionNode) return;

  // Replace the entire "@query" range (from the `@` trigger to the cursor) with the mention node.
  const context = getMentionContext(state);
  let from = pos - 1;
  let to = pos;

  if (context) {
    from = context.triggerPos;
    to = context.head;
  }

  let tr = state.tr.replaceWith(from, to, mentionNode);

  // Insert a trailing space so the caret sits after the mention on the same line.
  const after = from + mentionNode.nodeSize;
  tr = tr.insert(after, state.schema.text(" "));
  tr = tr.scrollIntoView();

  view.dispatch(tr);
}
