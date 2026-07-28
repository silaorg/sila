import path from "node:path";
import {
  loadChannelInstructions,
  loadChannelLanguageProvider,
  loadChannelTools,
} from "./channel-utils.js";

/**
 * Creates the agent runtime shared by every threaded chat channel.
 *
 * @param {{
 *  channelPath: string;
 *  channelName: string;
 *  createAgentRuntime: (options: {
 *    lang: import("aiwrapper").LanguageProvider;
 *    instructions: string;
 *    loadInstructions: (input: { threadId: string; threadDir: string }) => Promise<string>;
 *    loadTools: (input: { threadId: string; threadDir: string }) => Promise<Array<any>>;
 *    defaultCwd: string;
 *  }) => import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime;
 * }} input
 */
export async function createChannelAgentRuntime(input) {
  const workspacePath = path.resolve(input.channelPath, "..", "..");
  const { lang } = await loadChannelLanguageProvider(input.channelPath);
  const instructions = await loadChannelInstructions(workspacePath, input.channelName);

  return input.createAgentRuntime({
    lang,
    defaultCwd: workspacePath,
    instructions,
    loadInstructions: ({ threadDir }) =>
      loadChannelInstructions(workspacePath, input.channelName, threadDir),
    loadTools: (runtimeInput) =>
      loadChannelTools(workspacePath, input.channelName, runtimeInput),
  });
}
