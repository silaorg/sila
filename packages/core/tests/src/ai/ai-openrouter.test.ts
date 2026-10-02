import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AgentServices, ChatAppData, Space, WrapChatAgent, providers,
  type ThreadMessage,
} from '@sila/core';
import { ThreadTitleAgent } from '../../../src/agents/ThreadTitleAgent';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { getEnvVar } from '../setup/env';

const apiKey = getEnvVar('OPENROUTER_API_KEY', 'your_openrouter_api_key_here');
const defaultModel = providers.find(p => p.id === 'openrouter')!.defaultModel!;
const targets = [
  { target: 'auto', model: defaultModel },
  { target: 'openrouter/anthropic/claude-sonnet-5.5', model: 'anthropic/claude-sonnet-5.5' },
  { target: 'openrouter/google/gemini-3.8-flash', model: 'google/gemini-3.8-flash' },
];

// Real requests: skipped without a key. Use a temporary workspace per case.
describe.skipIf(!apiKey)('OpenRouter desktop chat integration', () => {
  let tempDir: string | undefined;
  let chat: ChatAppData | undefined;

  afterEach(async () => {
    chat?.triggerEvent('stop-message', {});
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it.each(targets)('$target streams, runs tools, and continues the conversation', async ({ target, model }) => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sila-openrouter-'));
    const space = Space.newSpace(crypto.randomUUID());
    space.setFileStoreProvider({
      getSpaceRootPath: () => tempDir!,
      getFs: () => new NodeFileSystem(),
    });
    space.saveModelProviderConfig({ id: 'openrouter', type: 'cloud', apiKey: apiKey! });
    space.addAppConfig({
      id: 'smoke', name: 'OpenRouter smoke test', button: 'New query', visible: true,
      description: 'Temporary integration test', targetLLM: target,
      instructions: 'Follow the user instructions exactly. Keep replies short.',
    });
    const tree = ChatAppData.createNewChatTree(space, 'smoke');
    chat = new ChatAppData(space, tree);
    const services = new AgentServices(space);
    const agent = new WrapChatAgent(chat, services, tree);
    await agent.run();

    let sawStreaming = false;
    const unsubscribe = tree.tree.observeOpApplied(op => {
      if ('transient' in op && op.transient && 'key' in op && op.key === 'text') {
        sawStreaming = true;
      }
    });

    try {
      await chat.newMessage({
        role: 'user',
        text: 'Use the mkdir tool to create file:smoke-check, then reply exactly SILA_OK.',
      });
      const first = await waitForReply(chat, 0);
      expect(first.text).toContain('SILA_OK');
      expect(first.modelProvider).toBe('openrouter');
      expect(first.modelId).toBe(model);
      expect(first.inProgress).toBeFalsy();
      expect(sawStreaming).toBe(true);
      const messages = chat.messageVertices.map(v => v.getAsTypedObject<ThreadMessage>());
      expect(messages.some(m => m.toolRequests?.some(t => t.name === 'mkdir'))).toBe(true);
      expect(messages.some(m => m.toolResults?.some(t => t.name === 'mkdir' && String(t.result).includes('Created directory')))).toBe(true);

      const before = chat.messageVertices.length;
      await chat.newMessage({ role: 'user', text: 'What directory did you just create? Reply with only its name.' });
      const second = await waitForReply(chat, before);
      expect(second.text).toContain('smoke-check');

      if (target === 'auto') {
        const titleAgent = new ThreadTitleAgent(services, { targetLLM: target });
        const result = await titleAgent.run({
          messages: chat.messageVertices.map(v => v.getAsTypedObject<ThreadMessage>()),
        });
        expect(result.title.trim().length).toBeGreaterThan(0);
      }
    } finally {
      if (typeof unsubscribe === 'function') unsubscribe();
    }
  }, 180_000);
});

async function waitForReply(chat: ChatAppData, after: number): Promise<ThreadMessage> {
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    const messages = chat.messageVertices.slice(after).map(v => v.getAsTypedObject<ThreadMessage>());
    const error = messages.find(m => m.role === 'error');
    if (error) throw new Error(error.text ?? 'OpenRouter returned an error');
    const last = messages.at(-1);
    if (last?.role === 'assistant' && !last.inProgress && last.text?.trim() && last.modelId) return last;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for the OpenRouter assistant reply');
}
