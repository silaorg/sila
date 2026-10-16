import { test } from "node:test";
import { deepEqual, equal, ok, rejects, throws } from "node:assert/strict";
import { LangMessages, models } from "aiwrapper";
import { createMockLanguageProvider } from "../../src/mock-language-provider.js";
import {
  createCompressedLanguageProvider,
  estimateContextTokens,
  getCompressionBudget,
} from "../../src/agent-runtime/context-compression.js";

function history(size = 12) {
  const messages = new LangMessages();
  messages.instructions = "Follow the current workspace instructions.";
  for (let i = 0; i < size; i++) {
    messages.addUserMessage(`Request ${i}: ${"old context ".repeat(450)}`);
    messages.addAssistantMessage(`Completed ${i}.`);
  }
  messages.addUserMessage("Keep working; preserve my latest request exactly.");
  return messages;
}

function setup({ messages = history(), answer = "<summary>Earlier tasks completed; continue the latest request.</summary>", checkpoint, chat } = {}) {
  const summaries = [];
  const requests = [];
  const checkpoints = [];
  const lang = {
    name: "test-model",
    async chat(input, options) {
      if (input.instructions.startsWith("Summarize historical")) {
        equal(input.availableTools, undefined);
        ok(estimateContextTokens(input) < 9_600);
        summaries.push(input[0].text);
        if (answer instanceof Error) throw answer;
        return input.addAssistantMessage(answer);
      }
      requests.push(new LangMessages(input));
      return chat ? chat(input, options) : input.addAssistantMessage("Continued.");
    },
  };
  const provider = createCompressedLanguageProvider({
    lang, checkpoint, windowTokens: 12_000,
    onCheckpoint: async (value) => checkpoints.push(value),
  });
  return { messages, lang, provider, summaries, requests, checkpoints };
}

test("compression budget uses model limits, including routed names, with a fallback for unknown models", () => {
  const total = models.id("gpt-4o").context.total;
  equal(getCompressionBudget({ name: "gpt-4o" }, 300_000).windowTokens, total);
  equal(getCompressionBudget({ name: "openai/gpt-4o" }, 300_000).windowTokens, total);
  equal(getCompressionBudget({ name: "test-model" }).windowTokens, 100_000);
  equal(getCompressionBudget({ name: "gpt-4o" }, 12_000).inputTokens, 9_600);
  for (const value of [NaN, Infinity, -1, 0, 1.5, 1_023]) {
    throws(() => getCompressionBudget({}, value), /Compression window/);
  }
});

test("the demo provider preserves its full history for any model name", () => {
  for (const name of [undefined, "mock-cycle", "custom-demo"]) {
    const lang = createMockLanguageProvider(name);
    equal(createCompressedLanguageProvider({ lang }), lang);
  }
});

test("estimates include instructions, schemas, tool arguments/results, and images without base64 inflation", () => {
  const messages = new LangMessages("hello");
  const plain = estimateContextTokens(messages);
  messages.instructions = "instructions ".repeat(500);
  messages.availableTools = [{ name: "tool", description: "schema ".repeat(500), parameters: {} }];
  messages.addAssistantItems([{ type: "tool", name: "tool", callId: "1", arguments: { text: "x".repeat(5_000) } }]);
  messages.addToolResultsMessage([{ type: "tool-result", name: "tool", callId: "1", result: "x".repeat(5_000) }]);
  ok(estimateContextTokens(messages) > plain + 5_000);
  messages.addUserItems([{ type: "image", base64: "a".repeat(1_000_000) }]);
  const withImage = estimateContextTokens(messages);
  messages.at(-1).items[0].base64 = "small";
  equal(estimateContextTokens(messages), withImage);
  messages[0].meta = { text: "x".repeat(1_000_000) };
  equal(estimateContextTokens(messages), withImage);
  ok(estimateContextTokens(new LangMessages("日本語")) > estimateContextTokens(new LangMessages("abc")));
});

test("small conversations retain instructions and tools without a summary call", async () => {
  const messages = new LangMessages("hello");
  messages.instructions = "Current instructions.";
  const tools = [{ name: "inspect", parameters: {}, handler() {} }];
  messages.availableTools = tools;
  const { provider, summaries, checkpoints } = setup({ messages, chat(input) {
    equal(input.instructions, messages.instructions);
    equal(input.availableTools, tools);
    return input.addAssistantMessage("Hello.");
  } });
  equal(await provider.chat(messages), messages);
  deepEqual(Array.from(messages, (message) => message.text), ["hello", "Hello."]);
  equal(summaries.length, 0);
  equal(checkpoints.length, 0);
});

test("a 4096-token window compresses only after the 80-percent trigger is crossed", async () => {
  const messages = new LangMessages("Original goal: finish the report without publishing it.");
  messages.instructions = "Be helpful.";
  messages.addAssistantMessage("Background notes. ".repeat(450));
  messages.addUserMessage("Continue.");
  const checkpoints = [];
  let summaries = 0;
  const provider = createCompressedLanguageProvider({
    windowTokens: 4_096,
    lang: {
      async chat(input) {
        if (input.instructions.startsWith("Summarize historical")) {
          summaries++;
          return input.addAssistantMessage("<summary>Finish the report. Do not publish it.</summary>");
        }
        return input.addAssistantMessage("Continuing.");
      },
    },
    onCheckpoint: async (checkpoint) => checkpoints.push(checkpoint),
  });
  ok(estimateContextTokens(messages) < 3_276);
  await provider.chat(messages);
  equal(summaries, 0);
  messages.addAssistantMessage("Additional notes. ".repeat(100));
  messages.addUserMessage("Continue without publishing.");
  ok(estimateContextTokens(messages) >= 3_276);
  await provider.chat(messages);
  equal(checkpoints.length, 1);
  ok(checkpoints[0].tokensBefore >= 3_276);
  ok(checkpoints[0].tokensAfter < 3_276);
  equal(messages.at(-2).text, "Continue without publishing.");
});

test("summarizes older history, preserves the transcript, and reuses a saved checkpoint after restart", async () => {
  const run = setup();
  const original = JSON.stringify(run.messages);
  const count = run.messages.length;
  await run.provider.chat(run.messages);
  equal(JSON.stringify(run.messages.slice(0, count)), original);
  equal(run.messages.length, count + 1);
  equal(run.checkpoints.length, 1);
  ok(run.requests[0].length < count);
  equal(run.requests[0].at(-1).text, run.messages[count - 1].text);
  ok(run.summaries.length > 1, "oversized stored history is summarized in bounded pieces");
  const restart = setup({ messages: run.messages, checkpoint: run.checkpoints[0] });
  restart.messages.addUserMessage("Next step.");
  await restart.provider.chat(restart.messages);
  equal(restart.summaries.length, 0);
  ok(restart.requests[0][0].text.includes(run.checkpoints[0].summary));
});

test("repeated compression incorporates the previous summary and advances its boundary", async () => {
  const run = setup();
  await run.provider.chat(run.messages);
  run.messages.push(...history());
  const previousCalls = run.summaries.length;
  await run.provider.chat(run.messages);
  equal(run.checkpoints.length, 2);
  ok(run.checkpoints[1].throughMessageCount > run.checkpoints[0].throughMessageCount);
  ok(run.summaries[previousCalls].includes(run.checkpoints[0].summary));
});

test("switching to a smaller window can shrink an existing summary without advancing its boundary", async () => {
  const messages = new LangMessages("Keep working.");
  messages.instructions = "Be helpful.";
  messages.addAssistantMessage("Work in progress.");
  const checkpoints = [];
  const provider = createCompressedLanguageProvider({
    windowTokens: 4_096,
    checkpoint: { summary: "Earlier details. ".repeat(1_000), throughMessageCount: 2 },
    lang: {
      async chat(input) {
        if (input.instructions.startsWith("Summarize historical")) {
          ok(estimateContextTokens(input) < 3_276);
          return input.addAssistantMessage("<summary>Continue the work.</summary>");
        }
        equal(input.at(-1).text, "Keep working.");
        return input.addAssistantMessage("Continued.");
      },
    },
    onCheckpoint: async (checkpoint) => checkpoints.push(checkpoint),
  });
  await provider.chat(messages);
  equal(checkpoints.length, 1);
  equal(checkpoints[0].throughMessageCount, 2);
  equal(messages.length, 3);
});

test("recent parallel tool calls stay paired with all results", async () => {
  const messages = history();
  messages.addAssistantItems(["a", "b"].map((callId) => ({ type: "tool", name: "inspect", callId, arguments: {} })));
  messages.addToolResultsMessage([{ type: "tool-result", name: "inspect", callId: "a", result: "a".repeat(4_000) }]);
  messages.addToolResultsMessage([{ type: "tool-result", name: "inspect", callId: "b", result: "b".repeat(4_000) }]);
  const run = setup({ messages });
  await run.provider.chat(messages);
  const request = run.requests[0];
  equal(request.at(-3).role, "assistant");
  deepEqual(Array.from(request.at(-3).toolRequests, (item) => item.callId), ["a", "b"]);
  equal(request.at(-2).toolResults[0].callId, "a");
  equal(request.at(-1).toolResults[0].callId, "b");
});

test("an oversized tool result is summarized in pieces while the latest user request stays verbatim", async () => {
  const messages = new LangMessages("Inspect this, but do not modify it.");
  messages.instructions = "Be helpful.";
  messages.addAssistantItems([{ type: "tool", name: "inspect", callId: "1", arguments: {} }]);
  messages.addToolResultsMessage([{ type: "tool-result", name: "inspect", callId: "1", result: `START${"語".repeat(40_000)}END` }]);
  const run = setup({ messages });
  await run.provider.chat(messages);
  equal(run.checkpoints[0].throughMessageCount, 3);
  equal(run.requests[0].at(-1).text, messages[0].text);
  ok(run.summaries[0].includes("START"));
  ok(run.summaries.at(-1).includes("END"));
  equal(messages[2].toolResults[0].result.length, 40_008);
});

for (const answer of ["", "<summary>Truncated", "<summary></summary>", `<summary>${"x".repeat(5_000)}</summary>`, new Error("summary provider failed")]) {
  test(`failed summary preserves history and does not call the task model (${String(answer).slice(0, 35)})`, async () => {
    const run = setup({ answer });
    const original = JSON.stringify(run.messages);
    await rejects(run.provider.chat(run.messages));
    equal(JSON.stringify(run.messages), original);
    equal(run.checkpoints.length, 0);
    equal(run.requests.length, 0);
  });
}

test("oversized fixed context fails clearly without trying to summarize the user's request", async () => {
  const messages = new LangMessages("x".repeat(40_000));
  messages.instructions = "Be helpful.";
  const run = setup({ messages });
  await rejects(run.provider.chat(messages), /latest message, instructions, or tool definitions are too large/);
  equal(run.summaries.length, 0);
});

test("provider overflow triggers one compression retry before any response", async () => {
  let calls = 0;
  const run = setup({ messages: history(4), chat(input) {
    if (++calls === 1) throw new Error("context_length_exceeded");
    return input.addAssistantMessage("Recovered.");
  } });
  await run.provider.chat(run.messages);
  equal(calls, 2);
  equal(run.checkpoints.length, 1);
  equal(run.messages.answer, "Recovered.");
});

test("a second overflow is surfaced, and unrelated errors are never retried", async () => {
  for (const message of ["maximum context length exceeded", "rate limit exceeded"]) {
    const run = setup({ messages: history(4), chat() { throw new Error(message); } });
    await rejects(run.provider.chat(run.messages), new RegExp(message));
    equal(run.requests.length, message.startsWith("maximum") ? 2 : 1);
  }
});

test("an error after streaming or tool execution preserves new messages and cannot replay actions", async () => {
  const messages = new LangMessages("Run once.");
  messages.instructions = "Be helpful.";
  const run = setup({ messages, chat(input, options) {
    input.addAssistantItems([{ type: "tool", name: "mutate", callId: "1", arguments: {} }]);
    options.onResult(input.at(-1));
    input.addToolResultsMessage([{ type: "tool-result", name: "mutate", callId: "1", result: "done" }]);
    throw new Error("context_length_exceeded");
  } });
  await rejects(run.provider.chat(messages), /context_length_exceeded/);
  equal(run.requests.length, 1);
  equal(messages.length, 3);
  equal(messages.at(-1).toolResults[0].result, "done");
});

test("aborted compression and failed checkpoint writes never advance context", async () => {
  const run = setup();
  const controller = new AbortController();
  controller.abort();
  await rejects(run.provider.chat(run.messages, { signal: controller.signal }), { name: "AbortError" });
  equal(run.summaries.length, 0);
  let writes = 0;
  const provider = createCompressedLanguageProvider({
    lang: run.lang, windowTokens: 12_000,
    onCheckpoint() { writes++; throw new Error("disk full"); },
  });
  const original = JSON.stringify(run.messages);
  for (let i = 0; i < 2; i++) await rejects(provider.chat(run.messages), /disk full/);
  equal(writes, 2);
  equal(JSON.stringify(run.messages), original);
  equal(run.requests.length, 0);
});
