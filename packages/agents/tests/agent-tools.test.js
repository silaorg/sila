import { describe, it } from "node:test";
import { deepEqual, ok } from "node:assert";
import { Lang } from "aiwrapper";
import { createChatAgent } from "../src/chat-agent.js";
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
    ok(toolNames.includes("generate_image"));
    ok(toolNames.includes("generate_video"));
    ok(toolNames.includes("read_document"));
    ok(toolNames.includes("edit_document"));
    ok(toolNames.includes("apply_patch"));
    ok(toolNames.includes("apply_search_replace_patch"));
  });
});

describe("createChatAgent", () => {
  it("includes web_search and local tools", () => {
    const lang = Lang.mockOpenAI();
    const agent = createChatAgent(lang, {
      threadId: "thread-1",
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
    });

    const toolNames = (agent.messages.availableTools || []).map((tool) => tool.name);
    ok(toolNames.includes("web_search"));
    ok(toolNames.includes("execute_command"));
    ok(toolNames.includes("see"));
    ok(toolNames.includes("generate_image"));
    ok(toolNames.includes("generate_video"));
    ok(toolNames.includes("read_document"));
    ok(toolNames.includes("edit_document"));
    ok(toolNames.includes("apply_patch"));
    ok(toolNames.includes("apply_search_replace_patch"));
  });

  it("adds send_telegram_file only when sender is provided", () => {
    const lang = Lang.mockOpenAI();

    const withoutSender = createChatAgent(lang, {
      threadId: "thread-1",
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
    });
    const withSender = createChatAgent(lang, {
      threadId: "thread-1",
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      sendTelegramFile: async () => ({ messageId: 1 }),
    });

    const namesWithoutSender = (withoutSender.messages.availableTools || []).map((tool) => tool.name);
    const namesWithSender = (withSender.messages.availableTools || []).map((tool) => tool.name);

    ok(!namesWithoutSender.includes("send_telegram_file"));
    ok(namesWithSender.includes("send_telegram_file"));

    deepEqual(
      namesWithoutSender.filter((name) => name !== "send_telegram_file"),
      namesWithSender.filter((name) => name !== "send_telegram_file"),
    );
  });

  it("adds send_slack_file only when sender is provided", () => {
    const lang = Lang.mockOpenAI();

    const withoutSender = createChatAgent(lang, {
      threadId: "thread-1",
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
    });
    const withSender = createChatAgent(lang, {
      threadId: "thread-1",
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      sendSlackFile: async () => ({ fileId: "F1" }),
    });

    const namesWithoutSender = (withoutSender.messages.availableTools || []).map((tool) => tool.name);
    const namesWithSender = (withSender.messages.availableTools || []).map((tool) => tool.name);

    ok(!namesWithoutSender.includes("send_slack_file"));
    ok(namesWithSender.includes("send_slack_file"));

    deepEqual(
      namesWithoutSender.filter((name) => name !== "send_slack_file"),
      namesWithSender.filter((name) => name !== "send_slack_file"),
    );
  });

  it("appends custom tools after built-in tools", () => {
    const lang = Lang.mockOpenAI();
    const agent = createChatAgent(lang, {
      threadId: "thread-1",
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      customTools: [
        {
          name: "jira_search",
          description: "Search Jira issues.",
          parameters: { type: "object", properties: {} },
          async handler() {
            return { ok: true };
          },
        },
      ],
    });

    const toolNames = (agent.messages.availableTools || []).map((tool) => tool.name);
    ok(toolNames.includes("jira_search"));
    ok(toolNames.indexOf("jira_search") > toolNames.indexOf("apply_search_replace_patch"));
  });
});
