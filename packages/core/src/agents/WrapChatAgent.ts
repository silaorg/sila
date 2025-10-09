import { LangMessages } from "aiwrapper";
import { ChatAgent } from "./ChatAgent";
import { AgentServices } from "./AgentServices";
import { ChatAppData } from "@sila/core";

export type ChatStreamingEvent = {
  type: "streaming";
  data: LangMessages;
}

/**
 * A wrapper around a chat agent (from aiwrapper) that handles vertices in the app tree and 
 * decides when to reply
 */
export class WrapChatAgent {
  private chatAgent: ChatAgent;

  constructor(private data: ChatAppData, private agentServices: AgentServices) { 
    // Instantiate an agent
    this.chatAgent = new ChatAgent();
  }

  /**
   * We use the same agent convention with a "run" method that starts the agent
   */
  run() {
    // See if the agent needs to reply

    // Subscribe to new messages
  }

}