<script lang="ts">
  import type { ResolvedFileInfo } from "@sila/core";
  import { formatFileSize } from "@sila/client/utils/filePreview";

  const { file }: { file: ResolvedFileInfo } = $props();
</script>

<div class="w-full flex justify-center px-4 py-6">
  <div
    class="max-w-4xl w-full rounded bg-black text-white shadow-lg flex flex-col max-h-[calc(100vh-10rem)] overflow-hidden"
  >
    <div class="p-4 border-b border-white/10 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-medium break-words">{file.name}</h3>
        {#if file.size !== undefined}
          <p class="text-xs text-white/60 mt-1">
            Size: {formatFileSize(file.size)}
          </p>
        {/if}
      </div>
      <span class="text-[10px] uppercase tracking-wide text-white/50">
        Video
      </span>
    </div>

    <div class="p-4 overflow-auto flex-1 flex items-center justify-center">
      <video
        src={file.url}
        controls
        autoplay
        class="w-full max-h-full rounded bg-black"
      >
        <track kind="captions" />
      </video>
    </div>
  </div>
</div>


