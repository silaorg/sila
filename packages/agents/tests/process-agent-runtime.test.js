import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  ProcessAgentRuntime,
  createAgentWorkerEnvironment,
} from "../src/index.js";

const TEST_WORKER_PATH = fileURLToPath(
  new URL("./fixtures/test-worker.js", import.meta.url),
);

test("ProcessAgentRuntime sends messages and forwards worker events", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-process-"));
  const events = [];
  const runtime = new ProcessAgentRuntime({
    workspacePath,
    workerPath: TEST_WORKER_PATH,
    environment: {
      PATH: process.env.PATH,
      OPENAI_API_KEY: "provider-key",
      BETTER_AUTH_SECRET: "must-not-leak",
    },
  });

  const result = await runtime.handleThreadMessage({
    threadId: "thread-1",
    threadDir: path.join(workspacePath, "thread-1"),
    userId: "user-1",
    text: "Hello from API",
    onAssistantResponding() {
      events.push("responding");
    },
    onAssistantProgress(payload) {
      events.push(payload.text);
    },
  });

  assert.deepEqual(result, {
    responded: true,
    answer: "Hello from API",
    leakedApiSecret: false,
    hasProviderKey: true,
  });
  assert.deepEqual(events, ["responding", "Working"]);
  await runtime.stop();
});

test("createAgentWorkerEnvironment passes only system and provider values", () => {
  assert.deepEqual(
    createAgentWorkerEnvironment({
      PATH: "/usr/bin",
      LANG: "en_US.UTF-8",
      OPENAI_API_KEY: "provider-key",
      SOURCE_PATH: "/workspace/source",
      PTY_COMMAND_TIMEOUT_MS: "30000",
      BETTER_AUTH_SECRET: "platform-secret",
      HESWE_AUTH_DB_PATH: "/private/auth.sqlite",
    }),
    {
      HESWE_AGENT_WORKER: "1",
      LANG: "en_US.UTF-8",
      OPENAI_API_KEY: "provider-key",
      PATH: "/usr/bin",
      PTY_COMMAND_TIMEOUT_MS: "30000",
      SOURCE_PATH: "/workspace/source",
    },
  );
});

test("ProcessAgentRuntime stop is a no-op before the worker starts", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-process-"));
  const runtime = new ProcessAgentRuntime({
    workspacePath,
    workerPath: TEST_WORKER_PATH,
  });

  await runtime.stop();
});

test("ProcessAgentRuntime rejects thread directories outside the workspace", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-process-"));
  const runtime = new ProcessAgentRuntime({
    workspacePath,
    workerPath: TEST_WORKER_PATH,
  });

  await assert.rejects(
    runtime.handleThreadMessage({
      threadId: "thread-1",
      threadDir: path.dirname(workspacePath),
      userId: "user-1",
      text: "Outside",
    }),
    /threadDir must be inside its workspace/,
  );
  await runtime.stop();
});

test("ProcessAgentRuntime preserves worker errors", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-process-"));
  const runtime = new ProcessAgentRuntime({
    workspacePath,
    workerPath: TEST_WORKER_PATH,
  });

  await assert.rejects(
    runtime.handleThreadMessage({
      threadId: "thread-1",
      threadDir: path.join(workspacePath, "thread-1"),
      userId: "user-1",
      text: "__error__",
    }),
    (error) => {
      assert.equal(error.name, "TestAgentError");
      assert.equal(error.message, "Agent request failed");
      assert.equal(error.code, "test_failure");
      return true;
    },
  );
  await runtime.stop();
});

test("ProcessAgentRuntime restarts cleanly after partial output and a worker crash", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-process-"));
  const runtime = new ProcessAgentRuntime({
    workspacePath,
    workerPath: TEST_WORKER_PATH,
  });
  const input = {
    threadId: "thread-1",
    threadDir: path.join(workspacePath, "thread-1"),
    userId: "user-1",
  };

  await assert.rejects(
    runtime.handleThreadMessage({ ...input, text: "__crash__" }),
    /Agent worker sent invalid JSON/,
  );
  const result = await runtime.handleThreadMessage({
    ...input,
    text: "After restart",
  });

  assert.equal(result.answer, "After restart");
  await runtime.stop();
});


test("ProcessAgentRuntime receives final output before the worker closes", async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-process-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  const runtime = new ProcessAgentRuntime({ workspacePath, workerPath: TEST_WORKER_PATH });
  t.after(() => runtime.stop());

  const result = await runtime.handleThreadMessage({
    threadId: "thread-1",
    threadDir: path.join(workspacePath, "thread-1"),
    userId: "user-1",
    text: "__final_output__",
  });
  assert.equal(result.answer, "Last response");
});

test("ProcessAgentRuntime can retry after a launch failure", async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-process-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  let launches = 0;
  const runtime = new ProcessAgentRuntime({
    workspacePath,
    workerPath: TEST_WORKER_PATH,
    spawnProcess(command, args, options) {
      launches += 1;
      return spawn(launches === 1 ? path.join(workspacePath, "missing-node") : command, args, options);
    },
  });
  t.after(() => runtime.stop());
  const input = {
    threadId: "thread-1",
    threadDir: path.join(workspacePath, "thread-1"),
    userId: "user-1",
    text: "Hello",
  };

  await assert.rejects(runtime.handleThreadMessage(input), { code: "ENOENT" });
  assert.equal((await runtime.handleThreadMessage(input)).answer, "Hello");
});

test("ProcessAgentRuntime kills a worker that never acknowledges stop", { timeout: 10_000 }, async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-process-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  let child;
  const runtime = new ProcessAgentRuntime({
    workspacePath,
    workerPath: TEST_WORKER_PATH,
    spawnProcess(...args) {
      child = spawn(...args);
      return child;
    },
  });
  t.after(() => child?.kill("SIGKILL"));
  const input = {
    threadId: "thread-1",
    threadDir: path.join(workspacePath, "thread-1"),
    userId: "user-1",
  };
  await runtime.handleThreadMessage({ ...input, text: "__ignore_stop__" });

  await assert.rejects(runtime.stop(), /Agent worker did not stop/);
  assert.equal(child.signalCode, "SIGKILL");
  assert.equal((await runtime.handleThreadMessage({ ...input, text: "After stop" })).answer, "After stop");
  await runtime.stop();
});
