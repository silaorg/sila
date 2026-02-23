import { describe, it } from "node:test";
import { throws } from "node:assert/strict";
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
});
