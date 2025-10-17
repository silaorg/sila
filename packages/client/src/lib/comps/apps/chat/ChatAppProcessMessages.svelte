<script lang="ts">
  import type { ThreadMessage, Vertex } from "@sila/core";
  import type { ToolRequest, ToolResult } from "aiwrapper";

  let { vertices }: { vertices: Vertex[] } = $props();

  type ToolPair = {
    name: string;
    request: ToolRequest;
    result: ToolResult;
  };

  type ToolUsageMessagePair = {
    id: string;
    role: string;
    toolPairs: ToolPair[];
  };

  const messages: ToolUsageMessagePair[] = $derived.by(() => {
    const requestIndex = new Map<string, ToolRequest>();
    const out: ToolUsageMessagePair[] = [];

    for (const vertex of vertices) {
      const msg = vertex.getAsTypedObject<ThreadMessage>();

      let reqs: ToolRequest[] = [];
      let results: ToolResult[] = [];
      try {
        reqs = msg.toolRequests ? (JSON.parse(msg.toolRequests) as ToolRequest[]) : [];
      } catch {
        reqs = [];
      }
      try {
        results = msg.toolResults ? (JSON.parse(msg.toolResults) as ToolResult[]) : [];
      } catch {
        results = [];
      }

      const pairs: ToolPair[] = [];

      if (msg.role === "tool" && reqs.length > 0) {
        for (const r of reqs) {
          requestIndex.set(r.callId, r);
          pairs.push({ name: r.name, request: r, result: undefined as unknown as ToolResult });
        }
      }

      if (msg.role === "tool-results" && results.length > 0) {
        for (const res of results) {
          const matchedReq = requestIndex.get(res.toolId);
          if (matchedReq) {
            pairs.push({ name: res.name, request: matchedReq, result: res });
          } else {
            // Result without a known request (edge case)
            pairs.push({ name: res.name, request: undefined as unknown as ToolRequest, result: res });
          }
        }
      }

      out.push({ id: vertex.id, role: msg.role!, toolPairs: pairs });
    }

    return out;
  });
</script>

{#each messages as message (message.id)}
  <div class="space-y-2">
    {#each message.toolPairs as pair}
      {#if pair.request && !pair.result}
        Using tool: {pair.request.name}
        {#if Object.keys(pair.request.arguments || {}).length > 0}
          <ul class="ml-4">
            {#each Object.entries(pair.request.arguments || {}) as [key, value]}
              <li>{key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}</li>
            {/each}
          </ul>
        {/if}
      {/if}
      {#if pair.result}
        <strong>Result:</strong> {pair.result.result}
      {/if}
    {/each}
  </div>
{/each}
