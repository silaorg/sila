<script lang="ts">
  let { configId }: { configId?: string } = $props();
</script>

<div class="text-sm space-y-1">
  <div><span class="opacity-70">Assistant configId:</span> {configId || "unknown"}</div>
</div>


