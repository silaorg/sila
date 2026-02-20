import { describe, it } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { createToolExecuteCommand } from "../src/tools/execute-tool.js";

describe("executeTool", () => {
  it("has expected name and description", () => {
    const tool = createToolExecuteCommand();
    strictEqual(tool.name, "execute_command");
    ok(tool.description.includes("Execute"));
  });

  it("executes a command in stateless mode", async () => {
    const tool = createToolExecuteCommand();
    const result = await tool.handler({ command: 'echo "hello world"' });
    strictEqual(result.mode, "stateless");
    strictEqual(result.stdout.trim(), "hello world");
    strictEqual(result.stderr, "");
  });

  it("returns error for a failing command in stateless mode", async () => {
    const tool = createToolExecuteCommand();
    const result = await tool.handler({ command: "false" });
    strictEqual(result.mode, "stateless");
    ok(result.error);
    ok(result.error.includes("Command failed"));
  });

  it("routes shell control commands to PTY manager", async () => {
    const calls = [];
    const ptyManager = {
      startSession(sessionId) {
        calls.push(["startSession", sessionId]);
        return { status: "started", cwd: "/tmp", shell: "bash" };
      },
      stopSession(sessionId, reason) {
        calls.push(["stopSession", sessionId, reason]);
        return { status: "stopped", reason };
      },
      resetSession(sessionId) {
        calls.push(["resetSession", sessionId]);
        return { status: "reset", cwd: "/tmp", shell: "bash" };
      },
      getStatus(sessionId) {
        calls.push(["getStatus", sessionId]);
        return { running: false };
      },
      hasSession() {
        return false;
      },
    };

    const tool = createToolExecuteCommand({ sessionId: "thread-1", ptyManager });
    const start = await tool.handler({ command: "shell start" });
    strictEqual(start.mode, "pty");
    strictEqual(start.status, "started");

    const status = await tool.handler({ command: "shell status" });
    strictEqual(status.mode, "pty");
    strictEqual(status.running, false);

    const stop = await tool.handler({ command: "shell stop" });
    strictEqual(stop.mode, "pty");
    strictEqual(stop.status, "stopped");

    deepStrictEqual(calls, [
      ["startSession", "thread-1"],
      ["getStatus", "thread-1"],
      ["stopSession", "thread-1", "manual"],
    ]);
  });

  it("blocks interactive commands in active PTY mode", async () => {
    const ptyManager = {
      hasSession() {
        return true;
      },
      async execute() {
        throw new Error("Should not be called for interactive commands");
      },
    };

    const tool = createToolExecuteCommand({ sessionId: "thread-2", ptyManager });
    const result = await tool.handler({ command: "vim test.txt" });
    strictEqual(result.mode, "pty");
    ok(result.error.includes("Interactive terminal programs are blocked"));
  });
});
