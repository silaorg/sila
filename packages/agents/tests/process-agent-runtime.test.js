import assert from "node:assert/strict";
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
    /exited with code 17/,
  );
  const result = await runtime.handleThreadMessage({
    ...input,
    text: "After restart",
  });

  assert.equal(result.answer, "After restart");
  await runtime.stop();
});
