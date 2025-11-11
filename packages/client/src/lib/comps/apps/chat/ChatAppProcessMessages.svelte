<script lang="ts">
  import type { Vertex } from "@sila/core";
  import type { LangMessage, ToolRequest, ToolResult } from "aiwrapper";
  import type { ToolUsageMessagePair } from "./chatTypes";
  import ChatAppToolMessagePair from "./ChatAppToolMessagePair.svelte";

  let { vertices }: { vertices: Vertex[] } = $props();

  const messages: (ToolUsageMessagePair | LangMessage)[] = $derived.by(() => {
    const msgs: (ToolUsageMessagePair | LangMessage)[] = [];

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      const role = vertex.getProperty("role");

      // Legacy support: dedicated tool messages
      if (role === "tool") {
        const toolRequests = (vertex.getProperty("toolRequests") as ToolRequest[]) ?? [];
        const pairs: ToolUsageMessagePair[] = toolRequests.map((request) => ({
          id: request.callId,
          role: "tool",
          toolPair: {
            name: request.name,
            request,
            result: null,
          },
        }));

        if (
          vertices.length > i + 1 &&
          vertices[i + 1].getProperty("role") === "tool-results"
        ) {
          const resultsVertex = vertices[i + 1];
          const toolResults = (resultsVertex.getProperty("toolResults") as ToolResult[]) ?? [];

          for (const result of toolResults) {
            const pair = pairs.find((p) => p.id === (result.toolId ?? (result as any).callId));
            if (pair) {
              pair.toolPair.result = result;
            }
          }
        }

        msgs.push(...pairs);
        continue;
      }

      const toolRequests = (vertex.getProperty("toolRequests") as ToolRequest[]) ?? [];
      if (toolRequests.length > 0) {
        const currentResults = (vertex.getProperty("toolResults") as ToolResult[]) ?? [];
        let nextResults: ToolResult[] = [];

        if (
          currentResults.length === 0 &&
          vertices.length > i + 1 &&
          vertices[i + 1].getProperty("role") === "tool-results"
        ) {
          nextResults = (vertices[i + 1].getProperty("toolResults") as ToolResult[]) ?? [];
        }

        const pairs: ToolUsageMessagePair[] = toolRequests.map((request) => {
          const match =
            currentResults.find((r) => (r.toolId ?? (r as any).callId) === request.callId) ??
            nextResults.find((r) => (r.toolId ?? (r as any).callId) === request.callId) ??
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

      msgs.push(vertex.getAsTypedObject<LangMessage>());
    }

    return msgs;
  });
</script>

<div
  class="flex flex-col gap-2 mt-2 mb-2 max-h-[500px] overflow-y-auto text-sm opacity-75"
>
  {#each messages as message}
    {#if message.role === "tool"}
      <div class="border border-surface-100-900 p-2 rounded-md">
        <ChatAppToolMessagePair message={message as ToolUsageMessagePair} />
      </div>
    {/if}
  {/each}
</div>
