import { Vertex } from "@sila/core";

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