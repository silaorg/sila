import { InProcessChatAgentRuntime } from "./agent-runtime/chat-agent-runtime.js";
import {
  loadChannelEnvironment,
  loadChannelInstructions,
  loadChannelTools,
} from "./channels/channel-utils.js";
import { loadWorkspaceLanguageProvider } from "./providers.js";
import { ThreadStore } from "./thread-store.js";

export async function createAppAgentRuntime(options) {
  const workspacePath = options?.workspacePath;
  if (typeof workspacePath !== "string" || !workspacePath) {
    throw new Error("createAppAgentRuntime requires workspacePath.");
  }

  const provider = await loadWorkspaceLanguageProvider(workspacePath);
  const instructions = await loadChannelInstructions(workspacePath, "app");
  return new InProcessChatAgentRuntime({
    lang: provider.lang,
    defaultCwd: workspacePath,
    instructions,
    threadStore: options.threadStore instanceof ThreadStore
      ? options.threadStore
      : new ThreadStore(),
    alwaysRespond: true,
    loadInstructions: (input) =>
      loadChannelInstructions(workspacePath, "app", input.threadDir),
    loadTools: (input) => loadChannelTools(workspacePath, "app", input),
    loadEnvironment: (input) =>
      loadChannelEnvironment(workspacePath, input.threadDir),
  });
}
