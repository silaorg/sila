import { Space } from "../spaces/Space";
import { AgentServices } from "../agents/AgentServices";
import { ChatAppData } from "../spaces/ChatAppData";
import { AppTree } from "../spaces/AppTree";
import { WrapChatAgent } from "../agents/WrapChatAgent";
import { ThreadTitleAgent } from "../agents/ThreadTitleAgent";
import { ThreadMessage } from "../models";

export default class ChatAppBackend {
  private data: ChatAppData;
  private agentServices: AgentServices;
  private defaultChatAgent: WrapChatAgent;

  get appTreeId(): string {
    return this.appTree.tree.root!.id;
  }

  constructor(private space: Space, private appTree: AppTree) {
    console.log(`[ChatAppBackend] Initializing for space ${space.id} tree ${appTree.getId()}`);
    this.data = new ChatAppData(this.space, appTree);
    this.agentServices = new AgentServices(this.space);
    this.defaultChatAgent = new WrapChatAgent(this.data, this.agentServices, this.appTree);

    this.defaultChatAgent.subscribe((e) => {
      if (e.type === "messageGenerated") {
        // Agent has finished generating messages
        console.log("[ChatAppBackend] Chat agent finished generating messages");
        this.runTitleAgent();
      } else if (e.type === "error") {
        console.error("[ChatAppBackend] Chat agent error:", e.error);
      } else if (e.type === "state") {
        //console.log("Chat agent state changed to:", e.state);
      }
    });

    this.defaultChatAgent.run();
  }

  private async runTitleAgent(): Promise<void> {
    try {
      const messages = this.data.messageVertices.map(v => v.getAsTypedObject<ThreadMessage>());
      const currentTitle = this.data.title || "";

      // Get the same config that the chat agent uses. We would take only the targetLLM from it
      let config = this.data.configId ?
        this.agentServices.space.getAppConfig(this.data.configId) : undefined;

      if (!config) {
        config = this.agentServices.space.getAppConfig("default");
      }

      if (!config) {
        console.warn("No config found for title agent, skipping title generation");
        return;
      }

      const titleAgent = new ThreadTitleAgent(this.agentServices, { targetLLM: config.targetLLM });

      const result = await titleAgent.run({
        messages,
        title: currentTitle
      });

      if (result && result.title) {
        this.data.title = result.title;
        console.log("Title updated:", result.title);
      }
    } catch (error) {
      console.error("Title agent error:", error);
    }
  }
}