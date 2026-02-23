import { createChatAgent } from "./chat-agent.js";

export { createChatAgent };

export function createSlackChatAgent(lang, options) {
  return createChatAgent(lang, options);
}
