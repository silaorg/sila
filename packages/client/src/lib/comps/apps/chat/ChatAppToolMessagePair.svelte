<script lang="ts">
  import Spinner from "../../ui/Spinner.svelte";
  import type { ToolUsageMessagePair } from "./chatTypes";

  const { message }: { message: ToolUsageMessagePair } = $props();

  const toolName = $derived(message.toolPair.request.name);

  const inProgress = $derived(message.toolPair.result === null);
</script>

<span class="inline-flex items-center gap-1">
  Using {toolName}
  {#if inProgress}<Spinner />{/if}
</span>
{#if Object.keys(message.toolPair.request.arguments || {}).length > 0}
  <ul class="ml-4">
    {#each Object.entries(message.toolPair.request.arguments || {}) as [key, value]}
      <li>
        {key}: {typeof value === "object"
          ? JSON.stringify(value)
          : String(value)}
      </li>
    {/each}
  </ul>
{/if}
{#if message.toolPair.result}
  <div>
    Result: {JSON.stringify(message.toolPair.result.result, null, 2)}
  </div>
{/if}
