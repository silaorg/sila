import { Lang } from "aiwrapper";

const TOOL_COMMAND_HELP = 'Use tool: <name> followed by a JSON object, for example:\n\ntool: read_document\n{"path":"notes.md"}\n\nRelative file paths start in the thread directory; use an absolute path for other files.';

export const MOCK_REPLIES = Object.freeze([
  "Hey!",
  "Hello again. This is the second mock reply.",
  "This is reply three. A slightly longer message helps check how the conversation looks when a reply wraps onto another line.",
  "Reply four is a short checklist:\n\n- Upload a file.\n- Reference it in a message.\n- Move it into a folder.\n- Open its preview.",
  "**Reply five** includes a little formatting: bold text, *italic text*, and `inline code`. The content is fixed, so the same turn in the cycle always renders the same way.",
  "Reply six has two paragraphs. The first one is brief.\n\nThe second paragraph is longer and gives the message more height. It helps check spacing between paragraphs, the width of the message area, and where the next message begins.",
  "Seven. Still here.",
  "Reply eight includes a code block:\n\n```js\nconst provider = 'mock';\nconst replyCount = 10;\nconsole.log(`${provider}: ${replyCount} predictable replies`);\n```\n\nThis is sample text for checking code rendering.",
  "Reply nine is a longer paragraph. The mock provider runs locally and needs no API key. Ordinary messages receive the same ten replies in the same order. You can use it to check message wrapping, scrolling, attachments, and the layout of a conversation. Each thread has its own place in the cycle, so a new thread starts with the short greeting again. Existing threads continue from their saved history after the app restarts.",
  "Reply ten is the longest message in this cycle. It gives the conversation enough text to test scrolling and longer message layouts. The wording stays fixed so that screenshots and manual checks can be compared reliably.\n\nHere is a repeatable file workflow:\n\n1. Open Files and upload a small document.\n2. Create a folder and move the document into it.\n3. Rename the document and open its preview.\n4. Return to the conversation and insert an @ reference to the document.\n5. Attach another sample file and send the message.\n\nTo test a real tool, send tool: read_document followed by a JSON object with the file path. Tool commands run through the normal agent runtime and show their results. Ordinary messages still receive these sample replies, which lets you check their presentation without configuring an external service.\n\nThe next mock reply returns to the beginning of the cycle: Hey!",
]);

export function createMockLanguageProvider(model) {
  const lang = Lang.mockOpenAI({ model, mockResponseObject: { respond: true } });
  lang.chat = async (messages, options) => {
    options?.signal?.throwIfAborted();
    const replyCount = messages.filter((message) =>
      message.role === "assistant" && Number.isInteger(message.meta?.mock?.replyIndex),
    ).length;
    const replyIndex = replyCount % MOCK_REPLIES.length;
    let responseText = MOCK_REPLIES[replyIndex];
    let mockToolCalls;
    let mockMeta = { replyIndex };
    if (!options?.schema) {
      const last = messages[messages.length - 1];
      if (last?.role === "tool-results" && messages[messages.length - 2]?.meta?.mock?.toolCommand) {
        responseText = last.toolResults.map((item) =>
          `Tool result: ${item.name}\n\n\`\`\`json\n${JSON.stringify(item.result ?? null, null, 2)}\n\`\`\``,
        ).join("\n\n");
        mockMeta = undefined;
      } else if (last?.role === "user") {
        // App metadata holds the original text; channels add a user prefix.
        const text = (last.meta?.app?.text ?? last.text).replace(/^<@[^>]+>:\s*/, "").trim();
        if (/^tool:/.test(text)) {
          mockMeta = undefined;
          const command = text.match(/^tool:\s*([\w.-]+)\s+([\s\S]+)$/);
          try {
            if (!command) throw new Error("Missing tool name or inputs.");
            const inputs = JSON.parse(command[2]);
            if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
              throw new Error("Inputs must be a JSON object.");
            }
            mockToolCalls = [{ id: `mock_tool_${messages.length}`, name: command[1], argumentsChunks: [JSON.stringify(inputs)] }];
            mockMeta = { toolCommand: true };
          } catch (error) {
            responseText = `Invalid mock tool command: ${error.message}\n\n${TOOL_COMMAND_HELP}`;
          }
        }
      }
    }
    // A fresh adapter per request keeps concurrent threads independent.
    const adapter = Lang.mockOpenAI({
      model,
      mockResponseText: responseText,
      mockResponseObject: { respond: true },
      mockToolCalls,
    });
    const result = await adapter.chat(messages, options);
    if (!options?.schema && mockMeta) {
      const reply = result[result.length - 1];
      reply.meta = { ...reply.meta, mock: mockMeta };
    }
    if (mockToolCalls) {
      options?.signal?.throwIfAborted();
      const toolResults = await result.executeRequestedTools();
      if (toolResults) options?.onResult?.(toolResults);
    }
    return result;
  };
  return lang;
}
