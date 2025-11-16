<script lang="ts">
  import type { ResolvedFileInfo } from "@sila/core";
  import { formatFileSize } from "@sila/client/utils/filePreview";
  import { Markdown } from "@markpage/svelte";
  import { chatMarkdownOptions } from "../markdown/chatMarkdownOptions";

  const { file }: { file: ResolvedFileInfo } = $props();

  let textContent = $state<string | null>(null);
  let isTextLoading = $state(false);
  let textError = $state<string | null>(null);
  let lastLoadedUrl = $state<string | null>(null);

  // Load text content when the file changes
  $effect(() => {
    const url = file?.url;
    if (!url || url === lastLoadedUrl) return;

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
</script>

<div class="w-full flex justify-center px-4 py-6">
  <div
    class="max-w-4xl w-full rounded bg-white shadow-sm select-text flex flex-col max-h-[calc(100vh-10rem)] overflow-hidden"
  >
    <div class="p-4 border-b border-gray-200">
      <h3 class="text-sm font-medium break-words">{file.name}</h3>
      {#if file.size !== undefined}
        <p class="text-xs text-gray-500 mt-1">
          Size: {formatFileSize(file.size)}
        </p>
      {/if}
    </div>

    <div class="p-4 overflow-y-auto flex-1">
      {#if isTextLoading}
        <div class="text-sm text-gray-500">Loading…</div>
      {:else if textError}
        <div class="text-sm text-red-500">{textError}</div>
      {:else if textContent}
        {#if file.mimeType === "text/markdown" || file.mimeType === "text/x-markdown"}
          <div class="chat-message">
            <Markdown source={textContent} options={chatMarkdownOptions} />
          </div>
        {:else}
          <pre
            class="text-sm font-mono whitespace-pre-wrap break-words"
          >{textContent}</pre>
        {/if}
      {:else}
        <div class="text-sm text-gray-500">No content to display.</div>
      {/if}
    </div>
  </div>
</div>

