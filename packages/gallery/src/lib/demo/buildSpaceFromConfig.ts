import { Space, ChatAppData } from '@sila/core';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export type DemoConfig = {
  type: 'sila-space';
  version: '1';
  name: string;
  createdAt: string;
  onboarding?: boolean;
  description?: string;
  assistants: Array<{ id: string; name: string; button: string; visible?: boolean; description: string; instructions: string; targetLLM?: string }>;
  providers: Array<{ id: string; apiKey?: string }>;
  conversations: Array<{ title: string; assistant: string; messages: MessageNode }>;
};

type MessageNode = {
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  main?: boolean;
  children?: MessageNode[];
};

export async function buildSpaceFromConfig(config: DemoConfig): Promise<Space> {
  const space = Space.newSpace(genId());
  space.name = config.name;

  // Control onboarding via config; default is to skip onboarding in gallery
  const onboarding = config.onboarding ?? false;
  space.tree.setVertexProperty(space.rootVertex.id, 'onboarding', onboarding);

  // Assistants
  for (const a of config.assistants) {
    space.addAppConfig({
      id: a.id,
      name: a.name,
      button: a.button,
      visible: a.visible ?? true,
      description: a.description,
      instructions: a.instructions,
      targetLLM: a.targetLLM
    } as any);
  }

  // Providers
  for (const p of config.providers) {
    if (p.apiKey) {
      space.saveModelProviderConfig({ id: p.id, type: 'cloud', apiKey: p.apiKey } as any);
    }
  }

  // Conversations
  for (const c of config.conversations) {
    const appTree = ChatAppData.createNewChatTree(space, c.assistant);
    space.setAppTreeName(appTree.getId(), c.title);
    const chat = new ChatAppData(space, appTree);
    await addMessages(chat, c.messages);
  }

  return space;
}

async function addMessages(chat: ChatAppData, node: MessageNode): Promise<void> {
  const message = await chat.newMessage({ role: node.role, text: node.text });
  if (node.children) {
    for (const child of node.children) {
      await addMessages(chat, child);
    }
  }
}

