import { LangMessages, type LangMessage } from "aiwrapper";
import { Space, ChatAppData, uuid } from "@sila/core";

export type DemoChatHandle = {
  id: string;
  setMessages: (messages: LangMessages) => void;
  addMessage: (message: LangMessage) => void;
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

    const setMessages = (messages: LangMessages) => {
      for (const m of messages) {
        data.newLangMessage(m, false);
      }
    };

    const addMessage = (message: LangMessage) => {
      data.newLangMessage(message, false);
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

