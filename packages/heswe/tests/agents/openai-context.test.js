import { test } from "node:test";
import { deepEqual, equal, ok } from "node:assert/strict";
import { Lang, LangMessages, setHttpRequestImpl } from "aiwrapper";
import { createCompressedLanguageProvider } from "../../src/agent-runtime/context-compression.js";

function sseResponse(text) {
  const events = [
    { type: "response.created", response: { id: "response-new" } },
    { type: "response.output_item.added", item: { type: "message", id: "message-new", content: [] } },
    { type: "response.output_item.done", item: { type: "message", id: "message-new", content: [{ type: "output_text", text }] } },
    { type: "response.completed" },
  ];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}

test("replays compressed tool history through the OpenAI adapter with top-level calls and no old response chain", async () => {
  let request;
  setHttpRequestImpl(async (_url, options) => {
    request = JSON.parse(options.body);
    return sseResponse("Done.");
  });
  try {
    const lang = Lang.openai({
      apiKey: "test", model: "gpt-5.4",
      defaultOptions: { providerSpecificBody: { max_output_tokens: 765 } },
    });
    const messages = new LangMessages("Old details that must not be replayed.");
    messages.instructions = "Current instructions.";
    messages.addAssistantMessage("Old reply.");
    messages.addUserMessage("Inspect and update the fixture.");
    const operation = { type: "update_file", path: "fixture.txt", diff: "@@\n-old\n+new" };
    messages.addAssistantItems([
      { type: "text", text: "Checking the fixture." },
      { type: "reasoning", text: "Private reasoning summary." },
      { type: "tool", name: "read_document", callId: "read-1", arguments: { path: "fixture.txt" } },
      { type: "tool", name: "apply_patch", callId: "patch-1", arguments: { operation, status: "completed" } },
    ], { openaiResponseId: "response-old" });
    messages.addToolResultsMessage([
      { type: "tool-result", name: "read_document", callId: "read-1", result: { content: "old" } },
      { type: "tool-result", name: "apply_patch", callId: "patch-1", result: { status: "completed", output: "Updated fixture.txt" } },
    ]);
    messages.addUserMessage("Report the outcome without running the tools again.");
    const before = JSON.stringify(messages);
    const count = messages.length;
    const provider = createCompressedLanguageProvider({
      lang, checkpoint: { summary: "Earlier work completed.", throughMessageCount: 2 },
      onCheckpoint() { throw new Error("This small snapshot needs no further compression."); },
    });
    await provider.chat(messages);
    equal(request.truncation, "disabled");
    equal(request.previous_response_id, undefined);
    equal(request.max_output_tokens, 765);
    equal(request.instructions, "Current instructions.");
    ok(!JSON.stringify(request.input).includes("Old details"));
    ok(!JSON.stringify(request.input).includes("Private reasoning"));
    deepEqual(request.input.filter((item) => item.type), [
      { type: "function_call", call_id: "read-1", name: "read_document", arguments: '{"path":"fixture.txt"}' },
      { type: "apply_patch_call", call_id: "patch-1", operation, status: "completed" },
      { type: "function_call_output", call_id: "read-1", output: '{"content":"old"}' },
      { type: "apply_patch_call_output", call_id: "patch-1", status: "completed", output: "Updated fixture.txt" },
    ]);
    ok(request.input.filter((item) => item.content).every((item) => item.content.every((part) => /^(input|output)_text$/.test(part.type))));
    equal(JSON.stringify(messages.slice(0, count)), before);
    equal(messages.answer, "Done.");
    equal(messages.length, count + 1);
  } finally {
    setHttpRequestImpl((url, options) => fetch(url, options));
  }
});

test("recognizes an actual OpenAI adapter overflow error and retries with the compressed snapshot", async () => {
  const requests = [];
  setHttpRequestImpl(async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    if (requests.length === 1) {
      return new Response(JSON.stringify({ error: { code: "context_length_exceeded", message: "Too much input." } }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }
    return sseResponse(body.instructions.startsWith("Summarize historical")
      ? "<summary>Earlier notes reviewed. Continue.</summary>" : "Recovered.");
  });
  try {
    const messages = new LangMessages("Review the notes.");
    messages.instructions = "Be helpful.";
    messages.addAssistantMessage("Background notes. ".repeat(450));
    messages.addUserMessage("Continue.");
    const checkpoints = [];
    const provider = createCompressedLanguageProvider({
      lang: Lang.openai({ apiKey: "test", model: "gpt-5.4" }),
      windowTokens: 12_000,
      onCheckpoint: async (checkpoint) => checkpoints.push(checkpoint),
    });
    await provider.chat(messages);
    equal(requests.length, 3);
    equal(checkpoints.length, 1);
    ok(JSON.stringify(requests[2].input).length < JSON.stringify(requests[0].input).length);
    equal(messages.answer, "Recovered.");
  } finally {
    setHttpRequestImpl((url, options) => fetch(url, options));
  }
});

test("OpenAI replay keeps image inputs and failed tool outcomes", async () => {
  let body;
  setHttpRequestImpl(async (_url, options) => {
    body = JSON.parse(options.body);
    return sseResponse("Done.");
  });
  const messages = new LangMessages();
  messages.addUserItems([{ type: "image", base64: "test-image", mimeType: "image/jpeg" }]);
  messages.addAssistantItems([{ type: "tool", name: "apply_patch", callId: "failed", arguments: { operation: { type: "delete_file", path: "missing.txt" } } }]);
  messages.addToolResultsMessage([{ type: "tool-result", name: "apply_patch", callId: "failed", result: { status: "failed", output: "Missing file" } }]);
  const options = { providerSpecificBody: { max_output_tokens: 123 } };
  try {
    await Lang.openai({ apiKey: "test" }).chat(messages, options);
    equal(body.max_output_tokens, 123);
    deepEqual(body.input[0], { role: "user", content: [{ type: "input_image", image_url: "data:image/jpeg;base64,test-image" }] });
    deepEqual(body.input.at(-1), { type: "apply_patch_call_output", call_id: "failed", status: "failed", output: "Missing file" });
  } finally {
    setHttpRequestImpl((url, options) => fetch(url, options));
  }
});
