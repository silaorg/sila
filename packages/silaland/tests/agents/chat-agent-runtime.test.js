import { describe, it } from "node:test";
import { deepEqual, equal, throws } from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Lang, LangMessages } from "aiwrapper";
import { InProcessChatAgentRuntime, ThreadAgent } from "../../src/agent-runtime/index.js";

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

function createLoopingLang() {
  return {
    async askForObject() {
      return { object: { respond: true } };
    },
    async chat(messages, options = {}) {
      const result = messages instanceof LangMessages
        ? messages
        : new LangMessages(messages);
      const lastMessage = result[result.length - 1];

      if (lastMessage?.role === "tool-results") {
        result.addAssistantMessage("final answer");
        options.onResult?.(result[result.length - 1]);
        return result;
      }

      result.addAssistantItems([
        { type: "text", text: "I will check that first." },
        { type: "tool", name: "execute_command", callId: "call-1", arguments: { command: "shell status" } },
      ]);
      options.onResult?.(result[result.length - 1]);

      const toolResultsMessage = await result.executeRequestedTools();
      if (toolResultsMessage) {
        options.onResult?.(toolResultsMessage);
      }

      return result;
    },
  };
}

describe("InProcessChatAgentRuntime", () => {
  it("requires explicit instructions", () => {
    const lang = Lang.mockOpenAI();
    throws(
      () => new InProcessChatAgentRuntime({ lang, defaultCwd: process.cwd() }),
      /requires explicit non-empty instructions/i,
    );
  });
});

describe("ThreadAgent", () => {
  it("requires explicit instructions", () => {
    const lang = Lang.mockOpenAI();
    throws(
      () =>
        new ThreadAgent({
          threadDir: process.cwd(),
          threadId: "thread-1",
          lang,
          ptyManager: createPtyStub(),
          defaultCwd: process.cwd(),
        }),
      /requires explicit non-empty instructions/i,
    );
  });

  it("logs inbound and outbound messages to the console", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const lang = Lang.mockOpenAI({ mockResponseText: "assistant reply" });
    lang.askForObject = async () => ({ object: { respond: true } });
    const agent = new ThreadAgent({
      threadDir,
      threadId: "thread-1",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
    });
    const logs = [];
    const originalConsoleLog = console.log;
    console.log = (message) => {
      logs.push(String(message));
    };

    try {
      const result = await agent.processUserMessage({ userId: "user-1", text: "hello there" });
      equal(result.responded, true);
      equal(result.answer, "assistant reply");
    } finally {
      console.log = originalConsoleLog;
    }

    deepEqual(logs, [
      "[thread thread-1] user <@user-1>: hello there",
      "[thread thread-1] assistant: assistant reply",
    ]);
  });

  it("logs when the agent decides not to respond", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const lang = Lang.mockOpenAI();
    lang.askForObject = async () => ({ object: { respond: false } });
    const agent = new ThreadAgent({
      threadDir,
      threadId: "thread-2",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
    });
    const logs = [];
    const originalConsoleLog = console.log;
    console.log = (message) => {
      logs.push(String(message));
    };

    try {
      const result = await agent.processUserMessage({ userId: "user-2", text: "thanks" });
      equal(result.responded, false);
      equal(result.answer, "");
    } finally {
      console.log = originalConsoleLog;
    }

    deepEqual(logs, [
      "[thread thread-2] user <@user-2>: thanks",
      "[thread thread-2] assistant: [no response]",
    ]);
  });

  it("logs intermediate assistant text when the agent uses tools", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const loopMessages = [];
    const agent = new ThreadAgent({
      threadDir,
      threadId: "thread-tools",
      lang: createLoopingLang(),
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      onAssistantLoopMessage: async (payload) => {
        loopMessages.push(payload);
      },
      instructions: "Be helpful.",
    });
    const logs = [];
    const originalConsoleLog = console.log;
    console.log = (message) => {
      logs.push(String(message));
    };

    try {
      const result = await agent.processUserMessage({ userId: "user-tools", text: "check that" });
      equal(result.responded, true);
      equal(result.answer, "final answer");
    } finally {
      console.log = originalConsoleLog;
    }

    deepEqual(logs, [
      "[thread thread-tools] user <@user-tools>: check that",
      "[thread thread-tools] assistant [loop][tools: execute_command]: I will check that first.",
      "[thread thread-tools] assistant: final answer",
    ]);
    deepEqual(loopMessages, [
      { text: "I will check that first.", toolNames: ["execute_command"] },
    ]);
  });

  it("stores thread messages as json lines", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const lang = Lang.mockOpenAI();
    lang.askForObject = async () => ({ object: { respond: false } });
    const agent = new ThreadAgent({
      threadDir,
      threadId: "thread-jsonl",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
    });

    await agent.processUserMessage({ userId: "user-3", text: "hello jsonl" });

    const raw = await fs.readFile(path.join(threadDir, "messages.jsonl"), "utf8");
    const lines = raw.trim().split("\n").map((line) => JSON.parse(line));
    equal(lines.length, 1);
    deepEqual(lines[0], {
      role: "user",
      items: [{ type: "text", text: "<@user-3>: hello jsonl" }],
    });
  });

  it("loads legacy messages.json and rewrites history to messages.jsonl", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    await fs.writeFile(
      path.join(threadDir, "messages.json"),
      `${JSON.stringify([{ role: "user", items: [{ type: "text", text: "legacy message" }] }], null, 2)}\n`,
      "utf8",
    );

    const lang = Lang.mockOpenAI();
    lang.askForObject = async () => ({ object: { respond: false } });
    const agent = new ThreadAgent({
      threadDir,
      threadId: "thread-legacy",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
    });

    await agent.processUserMessage({ userId: "user-4", text: "new message" });

    const raw = await fs.readFile(path.join(threadDir, "messages.jsonl"), "utf8");
    const lines = raw.trim().split("\n").map((line) => JSON.parse(line));
    equal(lines.length, 2);
    deepEqual(lines.map((line) => line.role), ["user", "user"]);
    equal(lines[0].items[0].text, "legacy message");
    equal(lines[1].items[0].text, "<@user-4>: new message");
  });
});
