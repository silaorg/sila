import { describe, it, expect } from 'vitest';
import { Space, ChatAppData, WrapChatAgent, AgentServices } from '@sila/core';
import { LangMessage, LangMessages } from 'aiwrapper';
import type { LanguageProvider } from 'aiwrapper';

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
    services.lang = async (_model?: string): Promise<LanguageProvider> => {
      return {
        chat: async (input: LangMessages | LangMessage[], opts?: any) => {
          // simulate streaming
          opts?.onResult?.(new LangMessage('assistant', 'O'));
          opts?.onResult?.(new LangMessage('assistant', 'OK'));
          // finalize: return LangMessages with assistant OK
          const arr: LangMessage[] = input instanceof LangMessages
            ? Array.from(input)
            : Array.isArray(input)
              ? input.map((msg: any) => msg instanceof LangMessage ? msg : new LangMessage(msg.role, msg.items ?? msg.text ?? ''))
              : [];
          const result = new LangMessages(arr);
          result.addAssistantMessage('OK');
          return result as any;
        },
      } as any as LanguageProvider;
    };

    const agent = new WrapChatAgent(chatData, services, chatTree);
    agent.run();

    await chatData.newMessage({ role: 'user', text: 'Please say OK' });

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


