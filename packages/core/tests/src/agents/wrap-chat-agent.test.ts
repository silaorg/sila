import { describe, it, expect } from 'vitest';
import { Space } from '../../src/spaces/Space';
import { ChatAppData } from '../../src/spaces/ChatAppData';
import { WrapChatAgent } from '../../src/agents/WrapChatAgent';
import { AgentServices } from '../../src/agents/AgentServices';
import type { LanguageProvider, LangMessage } from 'aiwrapper';
import { LangMessages } from 'aiwrapper';

// Basic smoke test: creating a user message results in an assistant reply
describe('WrapChatAgent basic reply', () => {
  it('responds to a user message', async () => {
    const space = Space.newSpace('test-space');

    // Add assistant config and create chat tree
    const assistantId = 'assistant-1';
    space.addAppConfig({
      id: assistantId,
      name: 'Chat',
      visible: true,
      description: 'Test chat',
      instructions: 'Reply with exactly: OK'
    } as any);

    const chatTree = ChatAppData.createNewChatTree(space, assistantId);
    const chatData = new ChatAppData(space, chatTree);

    // Mock AgentServices.lang to return a fake provider that streams and finalizes
    const services = new AgentServices(space);
    // @ts-expect-error override for test
    services.lang = async (_model?: string): Promise<LanguageProvider> => {
      return {
        chat: async (input: LangMessages | LangMessage[], opts?: any) => {
          // simulate streaming
          opts?.onResult?.({ answer: 'O' });
          opts?.onResult?.({ answer: 'OK' });
          // finalize: return LangMessages with assistant OK
          const arr: LangMessage[] = Array.isArray(input) ? input : (input as any).toArray?.() ?? [];
          const result = new LangMessages([ ...arr, { role: 'assistant', content: 'OK' } as any ]);
          return result as any;
        },
      } as any as LanguageProvider;
    };

    const agent = new WrapChatAgent(chatData, services, chatTree);
    agent.run();

    await chatData.newMessage('user', 'Please say OK');

    // Wait briefly for reply
    await new Promise((r) => setTimeout(r, 100));

    const messages = chatData.messageVertices;
    expect(messages.length).toBeGreaterThan(1);
    const last = messages[messages.length - 1];
    const lastData: any = last.getAsTypedObject<any>();
    expect(lastData.role).toBe('assistant');
    expect(lastData.text).toBe('OK');
    expect(lastData.inProgress).toBeFalsy();
  });
});


