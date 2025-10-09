import { Space } from "../spaces/Space";
import { AgentServices } from "../agents/AgentServices";
import { ChatAppData } from "../spaces/ChatAppData";
import { AppTree } from "../spaces/AppTree";
import { WrapChatAgent } from "../agents/WrapChatAgent";

export default class ChatAppBackend {
  private data: ChatAppData;
  private agentServices: AgentServices;

  private defaultChatAgent: WrapChatAgent;

  // @TODO: should I have 3 agents here and run them in parallel or should the main agent invoke those?
  // 1. the main agent replies to messages
  // 2. the title agent updates the title
  // 3. the summarizer agent summarizes conversations by adding summary messages

  get appTreeId(): string {
    return this.appTree.tree.root!.id;
  }

  constructor(private space: Space, private appTree: AppTree) {
    this.data = new ChatAppData(this.space, appTree);
    this.agentServices = new AgentServices(this.space);
    this.defaultChatAgent = new WrapChatAgent(this.data, this.agentServices, this.appTree);

    this.defaultChatAgent.run();
  }
}