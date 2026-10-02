<script lang="ts">
  import type { ResolvedFileInfo } from "@sila/core";

  let {
    fileInfo,
    showGallery = false,
  }: {
    fileInfo: ResolvedFileInfo;
    showGallery?: boolean;
  } = $props();

  let imageElement: HTMLImageElement;
  let isLoading = $state(true);
  let hasError = $state(false);

  function handleImageLoad() {
    isLoading = false;
  }

  function handleImageError() {
    isLoading = false;
    hasError = true;
  }
</script>

<div class="image-preview relative inline-block">
  <img
    bind:this={imageElement}
    src={fileInfo.url}
    alt={fileInfo.name}
    class="rounded object-contain max-w-[240px] max-h-[200px]"
    onload={handleImageLoad}
    onerror={handleImageError}
  />
</div>
