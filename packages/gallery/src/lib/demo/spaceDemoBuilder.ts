import { Space, ChatAppData, uuid, type ThreadMessage } from "@sila/core";

export type DemoChatHandle = {
  id: string;
  setMessages: (messages: Partial<ThreadMessage>[]) => Promise<void> | void;
  addMessage: (message: Partial<ThreadMessage>) => Promise<void> | void;
  get: () => ChatAppData;
  data: ChatAppData;
};

export class DemoSpace {
  readonly id: string;
  name?: string;
  readonly chats: { id: string; title?: string; data: ChatAppData }[] = [];
  private space: Space;

  constructor(opts?: { name?: string }) {
    this.space = Space.newSpace(uuid());
    this.id = this.space.getId();
    if (opts?.name) {
      this.name = opts.name;
      this.space.name = opts.name;
    }
  }

  getSpace(): Space {
    return this.space;
  }

  newChat(title?: string, configId: string = "default"): DemoChatHandle {
    const appTree = ChatAppData.createNewChatTree(this.space, configId);
    const data = new ChatAppData(this.space, appTree);
    if (title) data.title = title;

    const entry = { id: data.threadId, title, data };
    this.chats.push(entry);

    const setMessages = async (messages: Partial<ThreadMessage>[]) => {
      for (const m of messages) {
        const role = (m.role === "user" || m.role === "assistant" || m.role === "error" || m.role === "tool" || m.role === "tool-results") ? m.role : "assistant";
        await data.newMessage(role, m.text ?? undefined, m.thinking ?? undefined);
      }
    };

    const addMessage = async (message: Partial<ThreadMessage>) => {
      const role = (message.role === "user" || message.role === "assistant" || message.role === "error" || message.role === "tool" || message.role === "tool-results") ? message.role : "assistant";
      await data.newMessage(role, message.text ?? undefined, message.thinking ?? undefined);
    };

    return {
      id: entry.id,
      setMessages,
      addMessage,
      get: () => data,
      data,
    };
  }

  getChat(id: string): ChatAppData | undefined {
    return this.chats.find(c => c.id === id)?.data;
  }
}

export function createDemoSpace(opts?: { name?: string }): DemoSpace {
  return new DemoSpace(opts);
}

