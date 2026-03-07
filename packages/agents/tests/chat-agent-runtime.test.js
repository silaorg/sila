import { describe, it } from "node:test";
import { deepEqual, equal, throws } from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Lang } from "aiwrapper";
import { InProcessChatAgentRuntime, ThreadAgent } from "../src/index.js";

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
});
