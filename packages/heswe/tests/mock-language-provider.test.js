import assert from "node:assert/strict";
import { test } from "node:test";
import { ChatAgent, LangMessages, z } from "aiwrapper";
import { createMockLanguageProvider, MOCK_REPLIES } from "../src/mock-language-provider.js";

test("mock always permits a channel reply without advancing the reply cycle", async () => {
  const provider = createMockLanguageProvider("mock-cycle");
  const decision = await provider.askForObject("Should we respond to thanks?", z.object({ respond: z.boolean() }));
  assert.equal(decision.object.respond, true);
  const messages = new LangMessages();
  messages.addUserMessage("thanks");
  const chunks = [];
  const result = await provider.chat(messages, { onResult: (message) => chunks.push(message.text) });
  assert.equal(result.answer, "Hey!");
  assert.ok(chunks.length > 0);
  assert.equal(result[result.length - 1].meta.mock.replyIndex, 0);
});

test("mock ignores other providers' replies and cycles through ten different sized replies", async () => {
  const messages = new LangMessages();
  messages.addUserMessage("earlier message");
  messages.addAssistantMessage("an earlier real provider reply");
  const lengths = new Set();
  for (let turn = 0; turn < 12; turn += 1) {
    messages.addUserMessage("anything at all");
    // Recreating the provider on every turn must not reset the cycle.
    const result = await createMockLanguageProvider("mock-cycle").chat(messages);
    assert.equal(result.answer, MOCK_REPLIES[turn % 10]);
    lengths.add(result.answer.length);
  }
  assert.equal(lengths.size, 10);
});

test("mock calls a tool once, streams its request, shows its result, and preserves the reply cycle", async () => {
  const calls = [];
  const agent = new ChatAgent(createMockLanguageProvider("mock-cycle"), { tools: [{
    name: "echo",
    description: "Echo inputs for testing.",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    handler: (inputs) => { calls.push(inputs); return { echoed: inputs.text }; },
  }] });
  await agent.run("hello");
  assert.equal(agent.messages.answer, "Hey!");
  const streamed = [];
  agent.subscribe((event) => {
    if (event.type === "streaming") streamed.push(...event.data.msg.toolRequests);
  });
  const result = await agent.run('<@tester>: tool: echo\n{"text":"A line\\nwith quotes: \\"yes\\""}');
  assert.deepEqual(calls, [{ text: 'A line\nwith quotes: "yes"' }]);
  assert.match(result.answer, /Tool result: echo/);
  assert.match(result.answer, /"echoed"/);
  assert.ok(streamed.some((request) => request.name === "echo"));
  await agent.run("hello again");
  assert.equal(agent.messages.answer, MOCK_REPLIES[1]);
  assert.equal(calls.length, 1);
  await agent.run('tool: echo {"text":"second call"}');
  assert.equal(calls.length, 2);
});

test("mock reports malformed commands and tool errors without getting stuck", async () => {
  const agent = new ChatAgent(createMockLanguageProvider("mock-cycle"), { tools: [{
    name: "fail",
    description: "Fail for testing.",
    parameters: { type: "object", properties: {} },
    handler: () => { throw new Error("Expected failure"); },
  }] });
  for (const text of ['tool: fail {bad}', 'tool: fail []', 'tool: fail null', 'tool: fail', 'tool:']) {
    const result = await agent.run(text);
    assert.match(result.answer, /Invalid mock tool command/);
    assert.equal(agent.messages[agent.messages.length - 1].toolRequests.length, 0);
  }
  assert.match((await agent.run('tool: missing {}')).answer, /ToolNotFound/);
  assert.match((await agent.run('tool: fail {}')).answer, /Expected failure/);
  assert.equal((await agent.run('Please explain tool: fail {}')).answer, "Hey!");
});

test("mock uses the original app command and does not parse tool text returned by tools", async () => {
  const calls = [];
  const agent = new ChatAgent(createMockLanguageProvider("mock-cycle"), { tools: [{
    name: "echo",
    description: "Echo text.",
    parameters: { type: "object", properties: {} },
    handler: (inputs) => { calls.push(inputs); return 'tool: echo {}'; },
  }] });
  agent.messages.addUserMessage('<@tester>: enriched text and attachment instructions');
  agent.messages[0].meta = { app: { text: 'tool: echo\n{"value":42}' } };
  const result = await agent.run([]);
  assert.deepEqual(calls, [{ value: 42 }]);
  assert.match(result.answer, /tool: echo/);
});

test("an aborted mock request does not execute tools", async () => {
  let called = false;
  const messages = new LangMessages('tool: echo {}', { tools: [{
    name: "echo", description: "Echo", parameters: {}, handler: () => { called = true; },
  }] });
  await assert.rejects(createMockLanguageProvider("mock-cycle").chat(messages, { signal: AbortSignal.abort() }), { name: "AbortError" });
  assert.equal(called, false);
});
