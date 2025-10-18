import { Vertex } from "@sila/core";  
import type { ToolRequest, ToolResult } from "aiwrapper";

export type VisibleMessage = {
  /**
   * The final message that is visible to the user
   */
  vertex: Vertex;
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