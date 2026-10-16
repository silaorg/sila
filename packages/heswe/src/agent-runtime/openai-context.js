// aiwrapper 3.0.5 nests replayed tool calls inside message content. Responses
// requires calls and results as separate input items when replaying a snapshot.
export function withOpenAIContext(lang, messages, options) {
  if (lang.name !== "OpenAI Responses") return options;
  return {
    ...options,
    providerSpecificBody: {
      ...lang.defaultOptions?.providerSpecificBody,
      ...options.providerSpecificBody,
      input: Array.from(messages).flatMap((message) => message.items.flatMap((item) => toInput(message.role, item))),
      previous_response_id: undefined,
      // Local compression owns omissions; the provider must report an overflow.
      truncation: "disabled",
    },
  };
}

function toInput(role, item) {
  if (item.type === "tool") {
    return [item.name === "apply_patch" ? {
      type: "apply_patch_call", call_id: item.callId,
      operation: item.arguments.operation, status: "completed",
    } : {
      type: "function_call", call_id: item.callId,
      name: item.name, arguments: JSON.stringify(item.arguments),
    }];
  }
  if (item.type === "tool-result") {
    if (item.name === "apply_patch") {
      return [{
        type: "apply_patch_call_output", call_id: item.callId,
        status: item.result?.status ?? "completed",
        output: item.result?.output ?? serializeResult(item.result),
      }];
    }
    return [{ type: "function_call_output", call_id: item.callId, output: serializeResult(item.result) }];
  }
  if (item.type === "image" && role === "user") {
    return [{ role, content: [{
      type: "input_image",
      image_url: item.url ?? `data:${item.mimeType ?? "image/png"};base64,${item.base64}`,
    }] }];
  }
  if (item.type === "text" || item.type === "image") {
    const text = item.type === "text" ? item.text
      : `[Previously generated image. ${item.metadata?.revisedPrompt ?? "Consult the original file if needed."}]`;
    return text ? [{ role, content: [{ type: role === "assistant" ? "output_text" : "input_text", text }] }] : [];
  }
  // Reasoning summaries are not the provider's replayable reasoning items.
  return [];
}

function serializeResult(result) {
  return typeof result === "string" ? result : JSON.stringify(result ?? null);
}
