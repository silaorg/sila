<script lang="ts">
  import type { ThreadMessage, Vertex } from "@sila/core";
  import type { LangMessage, ToolRequest, ToolResult } from "aiwrapper";
  import type { ToolUsageMessagePair, ToolPair } from "./chatTypes";
  import ChatAppToolMessagePair from "./ChatAppToolMessagePair.svelte";
  import { onMount } from "svelte";
  import { ChevronDown, ChevronRight } from "lucide-svelte";

  let { vertices }: { vertices: Vertex[] } = $props();

  let isExpanded = $state(false);

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
      } else {
        msgs.push(vertex.getAsTypedObject<LangMessage>());
      }
    }

    return msgs;
  });
</script>

<div
  class="flex flex-col gap-2 mt-2 mb-2 max-h-[300px] overflow-y-auto text-sm opacity-75"
>
  {#each messages as message}
    {#if message.role === "tool"}
      <div class="border border-surface-100-900 p-2 rounded-md">
        <ChatAppToolMessagePair message={message as ToolUsageMessagePair} />
      </div>
    {/if}
  {/each}
</div>
