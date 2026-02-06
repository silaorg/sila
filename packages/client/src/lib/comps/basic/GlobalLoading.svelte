<script lang="ts">
  import { ProgressRing } from "@skeletonlabs/skeleton-svelte";
  import { fade } from "svelte/transition";
  import { globalLoading } from "../../state/loading.svelte";
</script>

{#if globalLoading.count > 0}
  <div
    out:fade={{ duration: 200, delay: 300 }}
    class="fixed inset-0 flex items-center justify-center z-50 bg-surface-50-950"
  >
    <ProgressRing value={null} />
  </div>
{/if}
