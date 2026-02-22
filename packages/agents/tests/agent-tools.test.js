import { describe, it } from "node:test";
import { ok } from "node:assert";
import { Lang } from "aiwrapper";
import { createSlackChatAgent } from "../src/slack-agent.js";

function createPtyStub() {
  return {
    hasSession() {
      return false;
    },
    startSession() {
      return { status: "started", cwd: process.cwd(), shell: "bash" };
    },
    stopSession() {
      return { status: "stopped" };
    },
    resetSession() {
      return { status: "reset", cwd: process.cwd(), shell: "bash" };
    },
    getStatus() {
      return { running: false };
    },
    async execute() {
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
        cwd: process.cwd(),
        truncated: false,
        timedOut: false,
      };
    },
  };
}

describe("createSlackChatAgent", () => {
  it("includes web_search and local tools", () => {
    const lang = Lang.mockOpenAI();
    const agent = createSlackChatAgent(lang, {
      threadId: "thread-1",
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
    });

    const toolNames = (agent.messages.availableTools || []).map((tool) => tool.name);
    ok(toolNames.includes("web_search"));
    ok(toolNames.includes("execute_command"));
    ok(toolNames.includes("see"));
    ok(toolNames.includes("read_document"));
    ok(toolNames.includes("edit_document"));
    ok(toolNames.includes("apply_patch"));
    ok(toolNames.includes("apply_search_replace_patch"));
  });
});
