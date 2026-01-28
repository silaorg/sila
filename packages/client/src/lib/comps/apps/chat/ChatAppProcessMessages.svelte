<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { getToolUsagePairs } from "./chatTypes";
  import ChatAppToolUsageItem from "./ChatAppToolUsageItem.svelte";

  let { vertices }: { vertices: Vertex[] } = $props();

  // Here we're going to merge tool requests an tool results in pairs so we can render them from a dedicated component.
  const messages = $derived.by(() => getToolUsagePairs(vertices));
</script>

{#each messages as message, index}
  <ChatAppToolUsageItem {message} {messages} {index} />
{/each}
