<script lang="ts">
  import type { ResolvedFileInfo } from "@sila/core";

  const { file }: { file: ResolvedFileInfo } = $props();
</script>

<div class="w-full h-full">
  <iframe
    src={file.url}
    title={file.name}
    class="w-full h-full border-0"
  ></iframe>
</div>
