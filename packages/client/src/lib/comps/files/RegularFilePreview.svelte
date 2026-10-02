<script lang="ts">
  import { getFilePreviewConfig, formatFileSize } from '@sila/client/utils/filePreview';
  import type { ResolvedFileInfo } from '@sila/core';
  
  let {
    fileInfo,
    showGallery = false,
  }: {
    fileInfo: ResolvedFileInfo;
    showGallery?: boolean;
  } = $props();

  let previewConfig = $derived.by(() => {
    const mimeType = fileInfo?.mimeType;
    return getFilePreviewConfig(mimeType);
  });
</script>

<div class="regular-file-preview p-3 border rounded-lg bg-surface-50-950 transition-colors">
  <div class="flex items-center gap-3">
    <div class="text-2xl">{previewConfig.icon}</div>
    <div class="flex-1 min-w-0">
      <div class="font-medium text-sm truncate">{fileInfo.name}</div>
      <div class="text-xs opacity-60">
        {previewConfig.displayName} • {formatFileSize(fileInfo.size || 0)}
      </div>
    </div>
  </div>
</div>
