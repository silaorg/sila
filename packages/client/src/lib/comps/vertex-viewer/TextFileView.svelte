<script lang="ts">
  import type { ResolvedFileInfo } from "@sila/core";
  import { Markdown } from "@markpage/svelte";
  import { chatMarkdownOptions } from "../markdown/chatMarkdownOptions";
  import { i18n } from "@sila/client";

  const {
    file,
    reloadToken = 0,
  }: { file: ResolvedFileInfo; reloadToken?: number } = $props();

  let textContent = $state<string | null>(null);
  let isTextLoading = $state(false);
  let textError = $state<string | null>(null);
  let lastLoadedSignature = $state<string | null>(null);

  // Load text content when the file changes
  $effect(() => {
    const url = file?.url;
    const signature = url ? `${url}|${reloadToken}` : null;
    if (!signature || signature === lastLoadedSignature) return;

    lastLoadedSignature = signature;
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

<div class="w-full select-text">
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
      <pre class="text-sm font-mono whitespace-pre-wrap break-words">{textContent}</pre>
    {/if}
  {:else}
    <div class="text-sm">{i18n.texts.fileViewer.noContent}</div>
  {/if}
</div>
