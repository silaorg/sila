<script lang="ts">
  import type { ResolvedFileInfo } from "@sila/core";
  import { formatFileSize } from "@sila/client/utils/filePreview";

  const { file }: { file: ResolvedFileInfo } = $props();
</script>

<div class="w-full flex justify-center px-2 sm:px-4 py-6">
  <div class="w-full max-w-7xl rounded bg-surface-50-950 shadow-sm overflow-hidden">
    <div
      class="p-4 border-b border-surface-200-800 flex items-center justify-between gap-3"
    >
      <div class="min-w-0">
        <h3 class="text-sm font-medium break-words">{file.name}</h3>
      </div>
      <span class="text-[10px] uppercase tracking-wide">
        PDF
      </span>
    </div>

    <iframe
      src={file.url}
      title={file.name}
      class="w-full h-[calc(100vh-8rem)] border-0"
    ></iframe>
  </div>
</div>
