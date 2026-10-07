import { describe, it } from "node:test";
import { deepEqual, equal, rejects, throws } from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Lang, LangMessages } from "aiwrapper";
import { InProcessChatAgentRuntime, processThreadMessage } from "../../src/agent-runtime/index.js";

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

function createLoopingLang({ text = "I will check that first.", streamArguments = false } = {}) {
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
        ...(text ? [{ type: "text", text }] : []),
        { type: "tool", name: "execute_command", callId: "call-1", arguments: { command: "shell status" } },
      ]);
      const assistant = result[result.length - 1];
      if (streamArguments) {
        assistant.toolRequests[0].arguments = {};
        options.onResult?.(assistant);
        assistant.toolRequests[0].arguments = { command: "shell status" };
      }
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

describe("processThreadMessage", () => {
  it("requires explicit instructions", async () => {
    await rejects(
      processThreadMessage({
        threadDir: process.cwd(),
        threadId: "thread-1",
        lang: Lang.mockOpenAI(),
        ptyManager: createPtyStub(),
      }, { userId: "user-1", text: "hello" }),
      /requires explicit non-empty instructions/i,
    );
  });

  it("logs message metadata without leaking conversation content", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const lang = Lang.mockOpenAI({ mockResponseText: "assistant reply" });
    lang.askForObject = async () => ({ object: { respond: true } });
    const options = {
      threadDir,
      threadId: "thread-1",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
    };
    const logs = [];
    const originalConsoleLog = console.log;
    console.log = (message) => {
      logs.push(String(message));
    };

    try {
      const result = await processThreadMessage(options, { userId: "user-1", text: "hello there" });
      equal(result.responded, true);
      equal(result.answer, "assistant reply");
    } finally {
      console.log = originalConsoleLog;
    }

    deepEqual(logs, [
      "[thread thread-1] user message received (11 chars)",
      "[thread thread-1] assistant response completed (15 chars)",
    ]);
  });

  it("logs when the agent decides not to respond", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const lang = Lang.mockOpenAI();
    lang.askForObject = async () => ({ object: { respond: false } });
    const options = {
      threadDir,
      threadId: "thread-2",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
    };
    const logs = [];
    const originalConsoleLog = console.log;
    console.log = (message) => {
      logs.push(String(message));
    };

    try {
      const result = await processThreadMessage(options, { userId: "user-2", text: "thanks" });
      equal(result.responded, false);
      equal(result.answer, "");
    } finally {
      console.log = originalConsoleLog;
    }

    deepEqual(logs, [
      "[thread thread-2] user message received (6 chars)",
      "[thread thread-2] assistant: [no response]",
    ]);
  });

  it("can always respond without running the channel response gate", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const lang = Lang.mockOpenAI({ mockResponseText: "always replies" });
    lang.askForObject = async () => {
      throw new Error("response gate should not run");
    };
    const options = {
      threadDir,
      threadId: "thread-direct-chat",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
      alwaysRespond: true,
    };

    const result = await processThreadMessage(options, {
      userId: "user-direct",
      text: "thanks",
    });

    equal(result.responded, true);
    equal(result.answer, "always replies");
  });

  it("logs intermediate assistant text when the agent uses tools", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const loopMessages = [];
    const progressMessages = [];
    let respondStartCount = 0;
    const options = {
      threadDir,
      threadId: "thread-tools",
      lang: createLoopingLang(),
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      onAssistantResponding: async () => {
        respondStartCount += 1;
      },
      onAssistantLoopMessage: async (payload) => {
        loopMessages.push(payload);
      },
      onAssistantProgress: async (payload) => {
        progressMessages.push(payload);
      },
      instructions: "Be helpful.",
    };
    const logs = [];
    const originalConsoleLog = console.log;
    console.log = (message) => {
      logs.push(String(message));
    };

    try {
      const result = await processThreadMessage(options, { userId: "user-tools", text: "check that" });
      equal(result.responded, true);
      equal(result.answer, "final answer");
    } finally {
      console.log = originalConsoleLog;
    }

    deepEqual(logs, [
      "[thread thread-tools] user message received (10 chars)",
      "[thread thread-tools] assistant loop (24 chars) [tools: execute_command]",
      "[thread thread-tools] assistant response completed (12 chars)",
    ]);
    deepEqual(loopMessages, [
      { text: "I will check that first.", toolNames: ["execute_command"] },
    ]);
    deepEqual(progressMessages, [{
      text: "I will check that first.",
      toolNames: ["execute_command"],
      tools: [{
        name: "execute_command",
        arguments: { command: "shell status" },
      }],
    }]);
    equal(respondStartCount, 1);
  });

  it("publishes textless tool calls and updates their streamed arguments", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const progressMessages = [];
    const loopMessages = [];
    try {
      const result = await processThreadMessage({
        threadDir,
        threadId: "thread-silent-tools",
        lang: createLoopingLang({ text: "", streamArguments: true }),
        ptyManager: createPtyStub(),
        instructions: "Be helpful.",
        onAssistantProgress: async (payload) => progressMessages.push(payload),
        onAssistantLoopMessage: async (payload) => loopMessages.push(payload),
      }, { userId: "user-tools", text: "check that" });

      equal(result.answer, "final answer");
      deepEqual(progressMessages, [{
        text: "",
        toolNames: ["execute_command"],
        tools: [{ name: "execute_command", arguments: {} }],
      }, {
        text: "",
        toolNames: ["execute_command"],
        tools: [{ name: "execute_command", arguments: { command: "shell status" } }],
      }]);
      deepEqual(loopMessages, []);
    } finally {
      await fs.rm(threadDir, { recursive: true, force: true });
    }
  });

  it("stores thread messages as append-only events", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    const lang = Lang.mockOpenAI();
    lang.askForObject = async () => ({ object: { respond: false } });
    const options = {
      threadDir,
      threadId: "thread-jsonl",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
    };

    await processThreadMessage(options, { userId: "user-3", text: "hello jsonl" });

    const raw = await fs.readFile(path.join(threadDir, "messages.jsonl"), "utf8");
    const lines = raw.trim().split("\n").map((line) => JSON.parse(line));
    equal(lines.length, 1);
    equal(lines[0].type, "message");
    deepEqual(lines[0].message, {
      role: "user",
      items: [{ type: "text", text: "<@user-3>: hello jsonl" }],
    });
  });

  it("loads legacy messages.json and continues with append-only events", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-agent-"));
    await fs.writeFile(
      path.join(threadDir, "messages.json"),
      `${JSON.stringify([{ role: "user", items: [{ type: "text", text: "legacy message" }] }], null, 2)}\n`,
      "utf8",
    );

    const lang = Lang.mockOpenAI();
    lang.askForObject = async () => ({ object: { respond: false } });
    const options = {
      threadDir,
      threadId: "thread-legacy",
      lang,
      ptyManager: createPtyStub(),
      defaultCwd: process.cwd(),
      instructions: "Be helpful.",
    };

    await processThreadMessage(options, { userId: "user-4", text: "new message" });

    const raw = await fs.readFile(path.join(threadDir, "messages.jsonl"), "utf8");
    const lines = raw.trim().split("\n").map((line) => JSON.parse(line));
    equal(lines.length, 2);
    deepEqual(lines.map((line) => line.type), ["message", "message"]);
    equal(lines[0].message.items[0].text, "legacy message");
    equal(lines[1].message.items[0].text, "<@user-4>: new message");
  });
});
