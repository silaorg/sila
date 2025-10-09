import { describe, it, expect } from 'vitest';
import type { LanguageProvider, LangMessage } from 'aiwrapper';
import { LangMessages } from 'aiwrapper';
import { ChatAgent } from '../../../src/agents/ChatAgent';

describe('ChatAgent basic back-and-forth', () => {
  it('replies to a user and supports follow-up', async () => {
    // Mock provider that appends an assistant echo for each call
    const provider: LanguageProvider = {
      chat: async (input: LangMessages | LangMessage[], opts?: any) => {
        const arr: LangMessage[] = Array.isArray(input)
          ? input
          : (input as any).toArray?.() ?? [];
        // stream last chunk if any user message
        const lastUser = [...arr].reverse().find(m => m.role === 'user');
        if (lastUser) {
          const text = typeof lastUser.content === 'string' ? lastUser.content : '[parts]';
          opts?.onResult?.({ answer: String(text).slice(0, 2) });
        }
        const last = [...arr].reverse().find(m => m.role === 'user');
        const replyText = last ? `ECHO: ${typeof last.content === 'string' ? last.content : '[parts]'}` : 'ECHO: ';
        const out = new LangMessages([ ...arr, { role: 'assistant', content: replyText } as any ]);
        return out as any;
      }
    } as any;

    const agent = new ChatAgent(provider);

    // Round 1
    const result1 = await agent.run([
      { role: 'user', content: 'Hi' } as any,
    ]);
    const msgs1 = Array.from(result1 as LangMessages);
    expect(msgs1[msgs1.length - 1].role).toBe('assistant');
    expect(msgs1[msgs1.length - 1].content).toBe('ECHO: Hi');

    // Round 2 (follow-up)
    const result2 = await agent.run([
      { role: 'user', content: 'How are you?' } as any,
    ]);
    const msgs2 = Array.from(result2 as LangMessages);
    // Conversation should now include both turns and a new assistant reply
    expect(msgs2.filter(m => m.role === 'assistant').length).toBe(2);
    expect(msgs2[msgs2.length - 1].content).toBe('ECHO: How are you?');
  });
});

