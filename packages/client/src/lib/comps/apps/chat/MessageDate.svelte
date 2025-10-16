<script lang="ts">
  import { Tooltip } from "@skeletonlabs/skeleton-svelte";

  let { createdAt }: { createdAt: number } = $props();
  let openState = $state(false);

  function formatChatDateToTime(dateInMs: number) {
    const date = new Date(dateInMs);
    return date.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // Use 24-hour format
    });
  }

  function formatChatDate(dateInMs: number) {
    const date = new Date(dateInMs);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<Tooltip
  bind:open={openState}
  positioning={{ placement: "bottom" }}
  contentBase="card bg-surface-200-800 p-2"
  openDelay={200}
>
  {#snippet trigger()}
    <button class="cursor-default flex items-center">
      <small class="opacity-50">{formatChatDateToTime(createdAt)}</small>
    </button>
  {/snippet}
  {#snippet content()}
    <div class="flex items-center">
      <p>{formatChatDate(createdAt)}</p>
    </div>
  {/snippet}
</Tooltip> 