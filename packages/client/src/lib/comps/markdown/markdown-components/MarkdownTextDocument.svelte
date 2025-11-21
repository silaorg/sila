<script lang="ts">
  import { Markdown } from "@markpage/svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { ResolvedFileInfo, Vertex } from "@sila/core";
  import { chatMarkdownOptions } from "../chatMarkdownOptions";

  let { resolvedFile, fileVertex, fileName } = $props<{
    resolvedFile: ResolvedFileInfo;
    fileVertex: Vertex | null;
    fileName: string;
  }>();

  const clientState = useClientState();

  const isMarkdown = $derived(
    resolvedFile?.mimeType === "text/markdown" ||
    resolvedFile?.mimeType === "text/x-markdown" ||
    resolvedFile?.name?.toLowerCase().endsWith(".md") ||
    resolvedFile?.name?.toLowerCase().endsWith(".markdown")
  );

  let textContent = $state<string | null>(null);
  let isTextLoading = $state(false);
  let textError = $state<string | null>(null);
  let lastLoadedUrl = $state<string | null>(null);

  // Load text content when it's a text document
  $effect(() => {
    if (!resolvedFile?.url) {
      textContent = null;
      return;
    }

    const url = resolvedFile.url;
    if (url === lastLoadedUrl) return;

    lastLoadedUrl = url;
    isTextLoading = true;
    textError = null;
    textContent = null;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load file (status ${res.status})`);
        }
        const text = await res.text();
        textContent = text;
      })
      .catch((err) => {
        console.error("Failed to load text file", err);
        textError = "Unable to load file content.";
      })
      .finally(() => {
        isTextLoading = false;
      });
  });

  function openFile() {
    if (!fileVertex || !clientState.currentSpaceState?.vertexViewer) {
      return;
    }

    clientState.currentSpaceState.vertexViewer.openVertex(fileVertex);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFile();
    }
  }
</script>

<div
  class="markdown-text-document"
  onclick={openFile}
  onkeydown={handleKeyDown}
  role="button"
  tabindex="0"
  aria-label={`Open document: ${fileName}`}
>
  <button
    class="markdown-text-button"
    onclick={(e) => {
      e.stopPropagation();
      openFile();
    }}
    type="button"
    aria-label={`Open document: ${fileName}`}
  >
    Open
  </button>
  <div class="markdown-text-content-wrapper">
    {#if isTextLoading}
      <div class="text-sm text-gray-500 italic">Loading document...</div>
    {:else if textError}
      <div class="text-sm text-gray-500 italic">{textError}</div>
    {:else if textContent}
      {#if isMarkdown}
        <div class="chat-message">
          <Markdown source={textContent} options={chatMarkdownOptions} />
        </div>
      {:else}
        <pre class="markdown-text-preview text-sm font-mono whitespace-pre-wrap break-words">{textContent}</pre>
      {/if}
    {/if}
    <div class="markdown-text-gradient-overlay"></div>
  </div>
</div>

<style>
  .markdown-text-document {
    position: relative;
    max-width: 100%;
    max-width: min(100%, 600px);
    border: 1px solid var(--color-surface-200-800);
    border-radius: 0.375rem;
    padding: 1rem;
    background: var(--color-surface-50-950);
    cursor: pointer;
  }

  .markdown-text-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    cursor: pointer;
    border: none;
    background: var(--color-surface-100-900);
    padding: 0.375rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-surface-900-100);
    transition: background-color 0.2s;
  }

  .markdown-text-button:hover {
    background: var(--color-surface-200-800);
  }

  .markdown-text-content-wrapper {
    position: relative;
    max-height: 300px;
    overflow: hidden;
  }

  .markdown-text-gradient-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--color-surface-50-950)
    );
    pointer-events: none;
  }

  .markdown-text-preview {
    max-width: 100%;
    margin: 0;
    padding: 0;
  }
</style>

