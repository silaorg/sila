<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorState, Plugin } from "prosemirror-state";
  import { EditorView } from "prosemirror-view";
  import {
    computePosition,
    offset as fuiOffset,
    flip,
    shift,
  } from "@floating-ui/dom";
  import {
    chatEditorSchema,
    createDocFromText,
    serializeDocToMarkdown,
  } from "./chatEditorSchema";
  import {
    createFileMentionPlugin,
    insertFileMention,
    type FileMention,
  } from "./chatMentionPlugin";
  import { Slice, Fragment, type Node as PMNode } from "prosemirror-model";

  interface ChatEditorProps {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    autofocus?: boolean;
    onChange?: (value: string) => void;
    onSubmit?: () => void;
    onEscape?: () => void;
    onFocusChange?: (focused: boolean) => void;
    getFileMentions?: (
      query: string
    ) => Promise<FileMention[]> | FileMention[];
    onPaste?: (e: ClipboardEvent) => void;
  }

  let {
    value = "",
    placeholder = "",
    disabled = false,
    autofocus = false,
    onChange,
    onSubmit,
    onEscape,
    onFocusChange,
    getFileMentions,
    onPaste,
  }: ChatEditorProps = $props();

  let host: HTMLDivElement | null = $state(null);
  let view: EditorView | null = null;
  let plugins: Plugin[] = [];
  let isFocused = $state(false);
  let mentionMenuOpen = $state(false);
  let mentionCoords = $state({ x: 0, y: 0 });
  let mentionFileInsert: ((file: FileMention) => void) | null = null;
  let mentionFiles = $state<FileMention[]>([]);
  let mentionSelectedIndex = $state(0);
  let lastQueryToken = 0;
  let mentionMenuEl: HTMLDivElement | null = $state(null);

  async function loadMentionFiles(query: string) {
    if (!getFileMentions) {
      mentionFiles = [];
      return;
    }
    const token = ++lastQueryToken;
    try {
      const result = await getFileMentions(query);
      if (token !== lastQueryToken) return;
      mentionFiles = result ?? [];
    } catch (err) {
      console.error("Failed to load file mentions", err);
      if (token === lastQueryToken) {
        mentionFiles = [];
      }
    }
  }

  function openMention(payload: {
    view: EditorView;
    anchorPos: number;
    insertPos: number;
    query: string;
  }) {
    const coords = payload.view.coordsAtPos(payload.anchorPos);
    // coords are already viewport-relative, perfect for a fixed-position popover
    mentionCoords = {
      x: coords.left,
      y: coords.bottom + 4,
    };

    mentionFileInsert = (file: FileMention) => {
      insertFileMention(payload.view, payload.insertPos, file);
      const markdown = serializeDocToMarkdown(payload.view.state.doc);
      onChange?.(markdown);
    };

    mentionSelectedIndex = 0;
    loadMentionFiles(payload.query);
    mentionMenuOpen = true;
    // Defer so the menu element exists in the DOM
    requestAnimationFrame(() => {
      void updateMentionPosition();
    });
  }

  function closeMention() {
    mentionMenuOpen = false;
    mentionFileInsert = null;
  }

  function handleFilePick(file: FileMention, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!mentionFileInsert) return;
    mentionFileInsert(file);
    closeMention();
    // Restore focus to editor after inserting mention
    requestAnimationFrame(() => view?.focus());
  }

  function handleMentionMenuClick(event: MouseEvent) {
    // Stop clicks inside the mention menu from propagating to the editor
    event.stopPropagation();
  }

  async function updateMentionPosition() {
    if (!mentionMenuEl) return;

    const virtualReference = {
      getBoundingClientRect() {
        const x = mentionCoords.x;
        const y = mentionCoords.y;
        return {
          x,
          y,
          left: x,
          right: x,
          top: y,
          bottom: y,
          width: 0,
          height: 0,
        } as DOMRect;
      },
    };

    const { x, y } = await computePosition(
      virtualReference as any,
      mentionMenuEl,
      {
        placement: "bottom-start",
        strategy: "fixed",
        middleware: [fuiOffset(4), flip(), shift({ padding: 8 })],
      }
    );

    Object.assign(mentionMenuEl.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  }

  function syncFromExternalValue(newValue: string) {
    if (!view) return;
    const current = serializeDocToMarkdown(view.state.doc);
    if (current === newValue) return;

    const doc = createDocFromText(newValue);
    const config = {
      schema: chatEditorSchema,
      plugins,
    } as const;
    const nextState = EditorState.create(doc ? { ...config, doc } : config);
    view.updateState(nextState);
  }

  function initEditor() {
    if (!host) return;

    const mentionPlugin = createFileMentionPlugin({
      open: openMention,
      close: closeMention,
      isOpen() {
        return mentionMenuOpen;
      },
    });

    // Plugin to handle paste events and convert newlines to hard_break nodes
    const pastePlugin = new Plugin({
      props: {
        handlePaste(view: EditorView, event: ClipboardEvent, slice: Slice) {
          const clipboardData = event.clipboardData;
          if (!clipboardData) return false;

          // Let parent handle file attachments first (via onPaste prop)
          if (onPaste) {
            onPaste(event);
            if (event.defaultPrevented) {
              return true;
            }
          }

          // Handle plain text with newlines by converting them to hard_break nodes
          const text = clipboardData.getData("text/plain");
          if (text && text.includes("\n")) {
            event.preventDefault();

            const pastedDoc = createDocFromText(text);
            if (!pastedDoc) return true;

            const { state, dispatch } = view;
            const pastedSlice = new Slice(pastedDoc.content, 0, 0);
            const tr = state.tr.replaceSelection(pastedSlice);
            dispatch(tr);
            return true;
          }

          // For HTML paste or text without newlines, let transformPasted handle it
          return false;
        },
        transformPasted(slice: Slice): Slice {
          // Convert newlines in text nodes to hard_break nodes (for HTML paste)
          const fragment = slice.content;
          const newNodes: PMNode[] = [];
          let needsTransform = false;

          fragment.forEach((node) => {
            if (node.type.name === "text" && node.text && node.text.includes("\n")) {
              needsTransform = true;
              const text = node.text;
              const lines = text.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (lines[i]) {
                  newNodes.push(chatEditorSchema.text(lines[i]));
                }
                if (i < lines.length - 1 || text.endsWith("\n")) {
                  newNodes.push(chatEditorSchema.nodes.hard_break.create());
                }
              }
            } else {
              newNodes.push(node);
            }
          });

          if (needsTransform) {
            const newFragment = Fragment.from(newNodes);
            return new Slice(newFragment, slice.openStart, slice.openEnd);
          }

          return slice;
        },
      },
    });

    const submitPlugin = new Plugin({
      props: {
        handleKeyDown(view, event) {
          if (mentionMenuOpen && mentionFiles.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              mentionSelectedIndex =
                (mentionSelectedIndex + 1) % mentionFiles.length;
              return true;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              mentionSelectedIndex =
                (mentionSelectedIndex - 1 + mentionFiles.length) %
                mentionFiles.length;
              return true;
            }

            if (event.key === "Enter" && !event.shiftKey) {
              const chosen =
                mentionFiles[mentionSelectedIndex] ?? mentionFiles[0];
              if (chosen) {
                event.preventDefault();
                handleFilePick(chosen);
                return true;
              }
            }
          }

          // Handle Shift+Enter to insert a hard break (newline)
          if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault();
            const { state, dispatch } = view;
            const hardBreak = chatEditorSchema.nodes.hard_break.create();
            const tr = state.tr.replaceSelectionWith(hardBreak);
            dispatch(tr);
            // onChange will be triggered via dispatchTransaction
            return true;
          }

          if (event.key === "Enter" && !event.shiftKey) {
            if (disabled) {
              return false;
            }
            event.preventDefault();
            onSubmit?.();
            return true;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            closeMention();
            onEscape?.();
            return true;
          }

          return false;
        },
      },
    });

    plugins = [mentionPlugin, pastePlugin, submitPlugin];

    const doc = createDocFromText(value);
    const config = {
      schema: chatEditorSchema,
      plugins,
    } as const;

    view = new EditorView(host, {
      state: EditorState.create(doc ? { ...config, doc } : config),
      dispatchTransaction(tr) {
        const newState = view!.state.apply(tr);
        view!.updateState(newState);
        const markdown = serializeDocToMarkdown(newState.doc);
        if (markdown !== value) {
          onChange?.(markdown);
        }
      },
      handleDOMEvents: {
        focus() {
          queueMicrotask(() => {
            isFocused = true;
            onFocusChange?.(true);
          });
          return false;
        },
        blur(view, event: FocusEvent) {
          // Don't close mention menu if focus is moving to the mention menu
          const relatedTarget = event.relatedTarget as HTMLElement | null;
          if (relatedTarget && mentionMenuEl?.contains(relatedTarget)) {
            return false;
          }
          queueMicrotask(() => {
            isFocused = false;
            closeMention();
            onFocusChange?.(false);
          });
          return false;
        },
      },
    });

    if (autofocus) {
      requestAnimationFrame(() => view?.focus());
    }
  }

  $effect(() => {
    syncFromExternalValue(value);
  });

  onMount(() => {
    initEditor();
  });

  onDestroy(() => {
    view?.destroy();
    view = null;
  });

</script>

<div class="chat-editor-area relative">
  {#if value.trim().length === 0}
    <div
      class="chat-editor-placeholder pointer-events-none absolute left-2 top-2 text-sm text-slate-500"
    >
      {placeholder}
    </div>
  {/if}

  <div
    class="chat-editor-host min-h-[48px] px-2 py-2 text-sm leading-normal"
    bind:this={host}
  ></div>

  {#if mentionMenuOpen}
    <div
      bind:this={mentionMenuEl}
      class="mention-menu z-20 min-w-[240px] rounded-md border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
      role="menu"
      tabindex="-1"
      onclick={handleMentionMenuClick}
      onmousedown={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeMention();
        }
      }}
    >
      <p
        class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Mention file
      </p>
      <div class="flex flex-col gap-1">
        {#each mentionFiles as file, index}
          <button
            type="button"
            class="mention-option flex items-center gap-2 rounded px-2 py-1 text-left text-slate-800 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-700"
            class:bg-slate-100={index === mentionSelectedIndex}
            class:dark:bg-slate-700={index === mentionSelectedIndex}
            onmousedown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFilePick(file, e);
            }}
          >
            <span class="truncate">{file.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .chat-editor-host :global(.ProseMirror) {
    outline: none;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .chat-editor-host :global(.ProseMirror p) {
    margin: 0;
  }

  .mention-menu {
    position: fixed;
  }
</style>


