import { ChatAgent } from "aiwrapper";
import {
  createToolApplyPatch,
  createToolEditDocument,
  createToolExecuteCommand,
  createToolReadDocument,
  createToolSeeImage,
  createToolSearchReplacePatch,
} from "./tools/index.js";

export function createChatAgent(lang, options) {
  const tools = [
    { name: "web_search" },
    createToolExecuteCommand({
      sessionId: options.threadId,
      ptyManager: options.ptyManager,
      defaultCwd: options.defaultCwd,
    }),
    createToolSeeImage({
      lang,
      baseDir: options.defaultCwd,
    }),
    createToolReadDocument({ baseDir: options.defaultCwd }),
    createToolEditDocument({ baseDir: options.defaultCwd }),
    createToolApplyPatch({ baseDir: options.defaultCwd }),
    createToolSearchReplacePatch({ baseDir: options.defaultCwd }),
  ];

  return new ChatAgent(lang, { tools });
}

export function createSlackChatAgent(lang, options) {
  return createChatAgent(lang, options);
}
