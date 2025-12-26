<script lang="ts">
  import type { Vertex } from "@sila/core";
  import type { LangMessage, ToolRequest, ToolResult } from "aiwrapper";
  import type { ToolUsageMessagePair } from "./chatTypes";
  import ChatAppToolMessagePair from "./ChatAppToolMessagePair.svelte";

  let { vertices }: { vertices: Vertex[] } = $props();

  // Here we're going to merge tool requests an tool results in pairs so we can render them from a dedicated component.
  const messages: ToolUsageMessagePair[] = $derived.by(() => {
    const msgs: ToolUsageMessagePair[] = [];

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];

      const toolRequests =
        (vertex.getProperty("toolRequests") as unknown as ToolRequest[]) ?? [];
      if (toolRequests.length > 0) {
        const currentResults =
          (vertex.getProperty("toolResults") as unknown as ToolResult[]) ?? [];
        let nextResults: ToolResult[] = [];

        if (
          currentResults.length === 0 &&
          vertices.length > i + 1 &&
          vertices[i + 1].getProperty("role") === "tool-results"
        ) {
          nextResults =
            (vertices[i + 1].getProperty(
              "toolResults"
            ) as unknown as ToolResult[]) ?? [];
        }

        const pairs: ToolUsageMessagePair[] = toolRequests.map((request) => {
          const match =
            currentResults.find(
              (r) => (r.toolId ?? (r as any).callId) === request.callId
            ) ??
            nextResults.find(
              (r) => (r.toolId ?? (r as any).callId) === request.callId
            ) ??
            null;

          return {
            id: request.callId,
            role: "tool",
            toolPair: {
              name: request.name,
              request,
              result: match,
            },
          };
        });

        msgs.push(...pairs);
        continue;
      }
    }

    return msgs;
  });
</script>

{#each messages as message}
  <div class="border border-surface-100-900 p-2 rounded-md">
    <ChatAppToolMessagePair {message} />
  </div>
{/each}
