<script lang="ts">
  import type { ThreadMessage, Vertex } from "@sila/core";
  import type { LangMessage, ToolRequest, ToolResult } from "aiwrapper";
  import type { ToolUsageMessagePair, ToolPair } from "./chatTypes";
  import ChatAppToolMessagePair from "./ChatAppToolMessagePair.svelte";
  import { onMount } from "svelte";

  let { vertices }: { vertices: Vertex[] } = $props();

  onMount(() => {
    console.log("vertices", vertices);
  });

  const messages: (ToolUsageMessagePair | LangMessage)[] = $derived.by(() => {
    const msgs: (ToolUsageMessagePair | LangMessage)[] = [];

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      if (vertex.getProperty("role") === "tool") {
        const toolRequests = JSON.parse(
          vertex.getProperty("toolRequests") as string
        ) as ToolRequest[];

        let pairs: ToolUsageMessagePair[] = [];
        for (const request of toolRequests) {
          // @TODO: add pairs by callIds (to make sure we get the correctt restuls in any order)

          pairs.push({
            id: request.callId,
            role: "tool",
            toolPair: {
              name: request.name,
              request: request,
              result: null, // Will add it later if it's present in the next vertex
            },
          });
        }

        if (
          vertices.length > i + 1 &&
          vertices[i + 1].getProperty("role") === "tool-results"
        ) {
          const resultsVertex = vertices[i + 1];
          const toolResults = JSON.parse(
            resultsVertex.getProperty("toolResults") as string
          ) as ToolResult[];

          for (const result of toolResults) {
            const pair = pairs.find((p) => p.id === result.toolId);
            if (pair) {
              pair.toolPair.result = result;
            }
          }
        }

        msgs.push(...pairs);
      }
    }

    return msgs;
  });
</script>

{#each messages as message}
  <div class="">
    {#each messages as message}
      {#if message.role === "tool"}
      <div class="bg-surface-100-900/50 p-2 rounded-md">
        <ChatAppToolMessagePair message={message as ToolUsageMessagePair} />
      </div>
      {/if}
    {/each}
  </div>
{/each}
