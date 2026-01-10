<script lang="ts">
  import type { ResolvedFileInfo } from "@sila/core";
  import { formatFileSize } from "@sila/client/utils/filePreview";
  import { Markdown } from "@markpage/svelte";
  import { chatMarkdownOptions } from "../markdown/chatMarkdownOptions";
  import { i18n } from "@sila/client";

  const {
    file,
    context = "modal",
  }: { file: ResolvedFileInfo; context?: "modal" | "tab" } = $props();

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
        textError = i18n.texts.markdownTextDocument.loadError;
      })
      .finally(() => {
        isTextLoading = false;
      });
  });
</script>

<div class="w-full flex justify-center px-4 py-6">
  <div
    class="max-w-4xl w-full rounded bg-surface-50-950 shadow-sm select-text flex flex-col"
    class:max-h-[calc(100vh-10rem)]={context === "modal"}
    class:overflow-hidden={context === "modal"}
  >
    {#if context === "modal"}
      <div class="p-4 border-b border-surface-200-800">
        <h3 class="text-sm font-medium break-words">{file.name}</h3>
      </div>
    {/if}

    <div class="p-4" class:overflow-y-auto={context === "modal"}>
      {#if isTextLoading}
        <div class="text-sm">{i18n.texts.fileViewer.loading}</div>
      {:else if textError}
        <div class="text-sm">{textError}</div>
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
        <div class="text-sm">{i18n.texts.fileViewer.noContent}</div>
      {/if}
    </div>
  </div>
</div>
