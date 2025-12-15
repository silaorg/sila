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
        await data.newMessage(m);
      }
    };

    const addMessage = async (message: Partial<ThreadMessage>) => {
      await data.newMessage(message);
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

