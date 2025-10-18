<script lang="ts">
  import type { ToolUsageMessagePair } from "./chatTypes";

  const { message }: { message: ToolUsageMessagePair } = $props();

  const toolName = $derived(message.toolPair.request.name);
</script>

Using {toolName}
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
