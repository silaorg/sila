<script lang="ts">
  import {
    getFilePreviewConfig,
    formatFileSize,
  } from "@sila/client/utils/filePreview";
  import type { ResolvedFileInfo } from "@sila/core";
  import { FileIcon } from "lucide-svelte";
  import { Markdown } from "@markpage/svelte";
  import { chatMarkdownOptions } from "../markdown/chatMarkdownOptions";

  const { file }: { file: ResolvedFileInfo } = $props();

  let previewConfig = $derived.by(() => {
    if (!file?.mimeType) return null;
    return getFilePreviewConfig(file.mimeType);
  });

  let textContent = $state<string | null>(null);
  let isTextLoading = $state(false);
  let textError = $state<string | null>(null);
  let lastLoadedUrl = $state<string | null>(null);

  // Load text/code content when viewing text-like files
  $effect(() => {
    if (!previewConfig) return;
    if (
      previewConfig.previewType !== "text" &&
      previewConfig.previewType !== "code"
    ) {
      return;
    }

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

{#if previewConfig}
  {#if previewConfig.previewType === "image"}
    <img
      src={file.url}
      alt={file.name}
      class="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] object-contain"
    />
  {:else if previewConfig.previewType === "video"}
    <video
      src={file.url}
      controls
      class="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)]"
      autoplay
    >
      <track kind="captions" />
    </video>
  {:else if previewConfig.previewType === "pdf"}
    <iframe src={file.url} class="border-0" title={file.name}></iframe>
  {:else if previewConfig.previewType === "text" || previewConfig.previewType === "code"}
    <div class="w-full flex justify-center px-4 py-6 select-text bg-white rounded shadow-sm">
      <div
        class="w-full p-6 overflow-auto"
      >
        <div class="mb-4">
          <h3 class="text-lg font-medium break-words">{file.name}</h3>
          {#if file.size !== undefined}
            <p class="text-xs text-gray-500 mt-1">
              Size: {formatFileSize(file.size)}
            </p>
          {/if}
        </div>

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
  {:else}
    <div class="bg-white text-black p-8 rounded text-center max-w-md">
      <div class="text-6xl mb-4"><FileIcon size={20} /></div>
      <h3 class="text-xl font-medium mb-2">{file.name}</h3>
    </div>
  {/if}
{/if}

