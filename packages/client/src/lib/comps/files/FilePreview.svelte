<script lang="ts">
  import { onMount } from "svelte";
  import { getFilePreviewConfig } from "@sila/client/utils/filePreview";
  import ImageFilePreview from "./ImageFilePreview.svelte";
  import RegularFilePreview from "./RegularFilePreview.svelte";
  import type { FileReference, ResolvedFileInfo } from "@sila/core";
  import { i18n } from "@sila/client";

  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();
  const fileResolver = $derived(clientState.currentSpaceState?.fileResolver);

  let {
    fileRef,
    showGallery = false,
    onGalleryOpen,
  }: {
    fileRef: FileReference;
    showGallery?: boolean;
    onGalleryOpen?: (resolvedFile: ResolvedFileInfo) => void;
  } = $props();

  // @TODO: try to derive from fileRef
  let resolvedFile: ResolvedFileInfo | null = $state(null);
  let isLoading = $state(true);
  let hasError = $state(false);
  let errorMessage = $state("");

  let previewConfig = $derived.by(() => {
    const mimeType = resolvedFile?.mimeType;
    return getFilePreviewConfig(mimeType);
  });

  async function loadFile() {
    try {
      isLoading = true;
      hasError = false;
      errorMessage = "";

      // Validate fileRef before attempting to resolve
      if (!fileRef || !fileRef.tree || !fileRef.vertex) {
        hasError = true;
        errorMessage = i18n.texts.files.invalidReference;
        console.warn("FilePreview: Invalid fileRef:", fileRef);
        return;
      }

      const fileInfo = await fileResolver?.resolveFileReference(fileRef);
      if (fileInfo) {
        resolvedFile = fileInfo;
      } else {
        hasError = true;
        errorMessage = i18n.texts.files.failedToLoad;
      }
    } catch (error) {
      hasError = true;
      errorMessage = error instanceof Error ? error.message : i18n.texts.files.unknownError;
    } finally {
      isLoading = false;
    }
  }

  function handleClick() {
    if (showGallery && previewConfig.gallerySupport && resolvedFile && onGalleryOpen) {
      clientState.currentSpaceState?.spaceTelemetry.filePreviewed({
        file_type: resolvedFile.mimeType || "unknown",
      });
      onGalleryOpen(resolvedFile);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (showGallery && previewConfig.gallerySupport && resolvedFile && onGalleryOpen) {
        clientState.currentSpaceState?.spaceTelemetry.filePreviewed({
          file_type: resolvedFile.mimeType || "unknown",
        });
        onGalleryOpen(resolvedFile);
      }
    }
  }

  onMount(() => {
    loadFile();
  });
</script>

<div 
  class="file-preview-wrapper cursor-pointer" 
  onclick={handleClick}
  onkeydown={handleKeydown}
  {...(showGallery && previewConfig.gallerySupport ? { tabindex: 0, role: "button" } : {})}
>
  {#if isLoading}
    <div
      class="flex items-center justify-center h-48 bg-surface-100-900 rounded animate-pulse"
    >
      <span class="text-surface-500-500-token">
        {i18n.texts.files.loadingFile}
      </span>
    </div>
  {:else if hasError}
    <div
      class="flex items-center justify-center h-48 bg-surface-100-900 rounded text-red-500"
    >
      <span>{i18n.texts.files.failedToLoadWithMessage(errorMessage)}</span>
    </div>
  {:else if resolvedFile}
    {#if previewConfig.previewType === "image"}
      <ImageFilePreview fileInfo={resolvedFile} {showGallery} />
    {:else}
      <RegularFilePreview fileInfo={resolvedFile} {showGallery} />
    {/if}
  {:else}
    <div
      class="flex items-center justify-center h-48 bg-surface-100-900 rounded"
    >
      <span class="text-surface-500-500-token">
        {i18n.texts.files.noFileData}
      </span>
    </div>
  {/if}
</div>
