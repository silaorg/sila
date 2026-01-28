import { Vertex } from "@sila/core";  
import type { ToolRequest, ToolResult } from "aiwrapper";

export type VisibleMessage = {
  /**
   * The final message that is visible to the user
   */
  vertex: Vertex | undefined;
  /**
   * Here go tools, reasoning, etc that leads the model to the final message
   */
  progressVertices: Vertex[];
}

export type ToolPair = {
  name: string;
  request: ToolRequest;
  result: ToolResult | null;
};

/**
 * Combines several pairs of tool calls and tool results that follow each other into a single message. So if an agent outputs: 
 *   - tool: { name: "read", request: { uri: "https://example.com" } }
 *   - tool-results: { name: "read", result: { content: "Example content" } }
 * This chain of tool calls and results from the same tool name will be combined into a ToolPair.
 */
export type ToolUsageMessagePair = {
  id: string;
  role: string;
  toolPair: ToolPair;
};

export function getToolUsagePairs(vertices: Vertex[]): ToolUsageMessagePair[] {
  const msgs: ToolUsageMessagePair[] = [];

  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i];

    const toolRequests =
      (vertex.getProperty("toolRequests") as unknown as ToolRequest[]) ?? [];
    if (toolRequests.length === 0) continue;

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
  }

  return msgs;
}
