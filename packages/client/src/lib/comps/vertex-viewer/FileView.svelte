<script lang="ts">
  import {
    getFilePreviewConfig,
  } from "@sila/client/utils/filePreview";
  import type { ResolvedFileInfo } from "@sila/core";
  import { FileIcon } from "lucide-svelte";
  import TextFileView from "./TextFileView.svelte";
  import VideoFileView from "./VideoFileView.svelte";
  import PdfFileView from "./PdfFileView.svelte";

  const {
    file,
    context = "modal",
  }: { file: ResolvedFileInfo; context?: "modal" | "tab" } = $props();

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
    <VideoFileView {file} />
  {:else if previewConfig.previewType === "pdf"}
    <PdfFileView {file} />
  {:else if previewConfig.previewType === "text" || previewConfig.previewType === "code"}
    <TextFileView {file} {context} />
  {:else}
    <div class="bg-white text-black p-8 rounded text-center max-w-md">
      <div class="text-6xl mb-4"><FileIcon size={20} /></div>
      <h3 class="text-xl font-medium mb-2">{file.name}</h3>
    </div>
  {/if}
{/if}
