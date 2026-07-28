import { ChatAgent } from "aiwrapper";
import {
  createToolApplyPatch,
  createToolEditDocument,
  createToolExecuteCommand,
  createToolReadDocument,
  createToolSeeImage,
  createToolSendSlackFile,
  createToolSendTelegramFile,
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

  if (options.sendTelegramFile) {
    tools.push(createToolSendTelegramFile(options.sendTelegramFile, { baseDir: options.defaultCwd }));
  }
  if (options.sendSlackFile) {
    tools.push(createToolSendSlackFile(options.sendSlackFile, { baseDir: options.defaultCwd }));
  }

  if (Array.isArray(options.customTools) && options.customTools.length) {
    const builtInToolNames = new Set(tools.map((tool) => tool.name).filter(Boolean));
    for (const tool of options.customTools) {
      if (!tool || typeof tool !== "object") {
        continue;
      }
      if (typeof tool.name !== "string" || !tool.name.trim().length) {
        continue;
      }
      if (builtInToolNames.has(tool.name)) {
        console.warn(`Skipping custom tool "${tool.name}" because it collides with a built-in tool.`);
        continue;
      }
      builtInToolNames.add(tool.name);
      tools.push(tool);
    }
  }

  return new ChatAgent(lang, { tools });
}
