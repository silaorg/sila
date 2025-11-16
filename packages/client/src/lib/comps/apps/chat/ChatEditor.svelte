<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorState, Plugin } from "prosemirror-state";
  import { EditorView } from "prosemirror-view";
  import {
    chatEditorSchema,
    createDocFromText,
  } from "./chatEditorSchema";
  import {
    createFileMentionPlugin,
    insertFileMention,
    type FileMention,
  } from "./chatMentionPlugin";

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
  let mentionAnchor = $state({ left: 0, top: 0 });
  let mentionFileInsert: ((file: FileMention) => void) | null = null;
  let mentionFiles = $state<FileMention[]>([]);
  let lastQueryToken = 0;

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
    if (!host) return;
    const coords = payload.view.coordsAtPos(payload.anchorPos);
    const hostRect = host.getBoundingClientRect();
    mentionAnchor = {
      left: coords.left - hostRect.left,
      top: coords.bottom - hostRect.top + 4,
    };

    mentionFileInsert = (file: FileMention) => {
      insertFileMention(payload.view, payload.insertPos, file);
      const text = payload.view.state.doc.textContent;
      onChange?.(text);
    };

    loadMentionFiles(payload.query);
    mentionMenuOpen = true;
  }

  function closeMention() {
    mentionMenuOpen = false;
    mentionFileInsert = null;
  }

  function handleFilePick(file: FileMention) {
    if (!mentionFileInsert) return;
    mentionFileInsert(file);
    closeMention();
    // Restore focus to editor after inserting mention
    requestAnimationFrame(() => view?.focus());
  }

  function syncFromExternalValue(newValue: string) {
    if (!view) return;
    const current = view.state.doc.textContent;
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

    const submitPlugin = new Plugin({
      props: {
        handleKeyDown(_view, event) {
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

    plugins = [mentionPlugin, submitPlugin];

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
        const text = newState.doc.textContent;
        if (text !== value) {
          onChange?.(text);
        }
      },
      handleDOMEvents: {
        focus() {
          isFocused = true;
          onFocusChange?.(true);
          return false;
        },
        blur() {
          isFocused = false;
          closeMention();
          onFocusChange?.(false);
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

  function handlePaste(e: ClipboardEvent) {
    if (onPaste) {
      onPaste(e);
    }
  }
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
    onpaste={handlePaste}
  ></div>

  {#if mentionMenuOpen}
    <div
      class="mention-menu absolute z-20 min-w-[240px] rounded-md border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
      style={`left:${mentionAnchor.left}px;top:${mentionAnchor.top}px;`}
    >
      <p
        class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Insert file
      </p>
      <div class="flex flex-col gap-1">
        {#each mentionFiles as file}
          <button
            type="button"
            class="mention-option flex items-center gap-2 rounded px-2 py-1 text-left text-slate-800 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-700"
            onclick={() => handleFilePick(file)}
          >
            <span
              class="text-[0.7rem] font-mono uppercase text-slate-500"
            >
              {file.kind === "workspace-asset" ? "WS" : "CHAT"}
            </span>
            <span class="truncate">{file.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .chat-editor-area {
    min-height: 56px;
  }

  .chat-editor-host :global(.ProseMirror) {
    outline: none;
    white-space: pre-wrap;
    word-break: break-word;
    min-height: 48px;
  }

  .chat-editor-host :global(.ProseMirror p) {
    margin: 0;
  }
</style>


