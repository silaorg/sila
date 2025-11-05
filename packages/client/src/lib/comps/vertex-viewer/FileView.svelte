<script lang="ts">
  import {
    getFilePreviewConfig,
    formatFileSize,
  } from "@sila/client/utils/filePreview";
  import type { ResolvedFileInfo } from "@sila/core";
  import { FileIcon } from "lucide-svelte";

  const { file }: { file: ResolvedFileInfo } = $props();

  let previewConfig = $derived.by(() => {
    if (!file?.mimeType) return null;
    return getFilePreviewConfig(file.mimeType);
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
    <div class="bg-white text-black p-8 rounded text-center max-w-md">
      <div class="text-6xl mb-4">{previewConfig.icon}</div>
      <h3 class="text-xl font-medium mb-2">{file.name}</h3>
      <div class="text-gray-600 mb-4 space-y-1">
        {#if file.size !== undefined}
          <p>Size: {formatFileSize(file.size)}</p>
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
