<script lang="ts">
  import { onDestroy, onMount } from "svelte";
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

  export let initialValue: string = "";
  export let onSave: (text: string) => void;
  export let onCancel: () => void;

  let editorHost: HTMLDivElement;
  let view: EditorView | null = null;
  let currentText = initialValue;
  let mentionAnchor = { left: 0, top: 0 };
  let mentionInsertPos: number | null = null;
  let mentionMenuOpen = false;

  const fakeFiles: FileMention[] = [
    {
      id: "workspace-style-guide",
      kind: "workspace-asset",
      name: "Brand Style Guide.pdf",
    },
    {
      id: "workspace-roadmap",
      kind: "workspace-asset",
      name: "2025 Roadmap.canvas",
    },
    {
      id: "chat-ai-spec",
      kind: "chat-file",
      name: "AI Mentions Spec.md",
    },
  ];

  $: isSaveDisabled = currentText.trim().length === 0;

  function openMention(payload: {
    view: EditorView;
    anchorPos: number;
    insertPos: number;
    query: string;
  }) {
    mentionInsertPos = payload.insertPos;
    const coords = payload.view.coordsAtPos(payload.anchorPos);
    const hostRect = editorHost.getBoundingClientRect();
    mentionAnchor = {
      left: coords.left - hostRect.left,
      top: coords.bottom - hostRect.top + 4,
    };
    mentionMenuOpen = true;
  }

  function closeMention() {
    mentionMenuOpen = false;
    mentionInsertPos = null;
  }

  function mentionIsOpen() {
    return mentionMenuOpen;
  }

  function handleFilePick(file: FileMention) {
    if (!view || mentionInsertPos === null) return;
    insertFileMention(view, mentionInsertPos, file);
    currentText = view.state.doc.textContent;
    closeMention();
    requestAnimationFrame(() => view?.focus());
  }

  function handleSave() {
    if (isSaveDisabled) return;
    onSave(currentText);
  }

  function setupEditor() {
    const mentionPlugin = createFileMentionPlugin({
      open: openMention,
      close: closeMention,
      isOpen: mentionIsOpen,
    });

    const submitPlugin = new Plugin({
      props: {
        handleKeyDown(_view, event) {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSave();
            return true;
          }
          return false;
        },
      },
    });

    const doc = createDocFromText(initialValue);

    view = new EditorView(editorHost, {
      state: EditorState.create({
        schema: chatEditorSchema,
        doc,
        plugins: [mentionPlugin, submitPlugin],
      }),
      dispatchTransaction(tr) {
        const newState = view!.state.apply(tr);
        view!.updateState(newState);
        currentText = newState.doc.textContent;
      },
    });
  }

  onMount(() => {
    setupEditor();
    requestAnimationFrame(() => view?.focus());
  });

  onDestroy(() => {
    view?.destroy();
    view = null;
  });
</script>

<div class="space-y-2">
  <div class="chat-editor-wrapper relative rounded-md border border-slate-300/60 px-3 py-2 text-[0.9375rem] dark:border-slate-600/80">
    <div class="chat-editor-host" bind:this={editorHost}></div>
    {#if mentionMenuOpen}
      <div
        class="mention-menu absolute z-20 min-w-[240px] rounded-md border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
        style={`left:${mentionAnchor.left}px;top:${mentionAnchor.top}px;`}
      >
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Insert file</p>
        <div class="flex flex-col gap-1">
          {#each fakeFiles as file}
            <button
              type="button"
              class="mention-option flex items-center gap-2 rounded px-2 py-1 text-left text-slate-800 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-700"
              on:click={() => handleFilePick(file)}
            >
              <span class="text-[0.7rem] font-mono uppercase text-slate-500">
                {file.kind === "workspace-asset" ? "WS" : "CHAT"}
              </span>
              <span class="truncate">{file.name}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="flex gap-2 justify-end">
    <button type="button" class="btn btn-sm preset-outline" on:click={onCancel}>
      Cancel
    </button>
    <button type="button" class="btn btn-sm preset-filled" on:click={handleSave} disabled={isSaveDisabled}>
      Save
    </button>
  </div>
</div>

<style>
  .chat-editor-wrapper {
    min-height: 80px;
  }

  .chat-editor-host :global(.ProseMirror) {
    outline: none;
    white-space: pre-wrap;
  }

  .chat-editor-host :global(.ProseMirror p) {
    margin: 0;
  }

  :global(.chat-file-mention) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.4rem;
    border-radius: 0.375rem;
    background: rgba(59, 130, 246, 0.16);
    color: rgb(37, 99, 235);
    font-size: 0.85em;
    font-weight: 600;
  }

  :global(.dark .chat-file-mention) {
    background: rgba(96, 165, 250, 0.15);
    color: rgb(191, 219, 254);
  }
</style>
