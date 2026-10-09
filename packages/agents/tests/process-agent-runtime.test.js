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
import { MOCK_REPLIES } from "../../heswe/src/mock-language-provider.js";

test("the real worker uses mock without keys and preserves each thread's cycle across restarts", async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-mock-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  const runtime = new ProcessAgentRuntime({ workspacePath, environment: { PATH: process.env.PATH } });
  t.after(() => runtime.stop());
  const input = { threadId: "cycle", threadDir: path.join(workspacePath, "cycle"), userId: "tester" };
  for (let turn = 0; turn < 12; turn += 1) {
    const reply = await runtime.handleThreadMessage({ ...input, text: turn % 2 ? "thanks" : "hello" });
    assert.equal(reply.responded, true);
    assert.equal(reply.answer, MOCK_REPLIES[turn % 10]);
    if (turn === 4) await runtime.stop();
  }
  const [first, second] = await Promise.all(["other-a", "other-b"].map((threadId) =>
    runtime.handleThreadMessage({ threadId, threadDir: path.join(workspacePath, threadId), userId: "tester", text: "hello" }),
  ));
  assert.equal(first.answer, "Hey!");
  assert.equal(second.answer, "Hey!");
});

test("mock runs real file tools once and persists requests and results across worker restarts", async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "agent-mock-tools-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  const runtime = new ProcessAgentRuntime({ workspacePath, environment: { PATH: process.env.PATH } });
  t.after(() => runtime.stop());
  const input = { threadId: "mock-thread", threadDir: path.join(workspacePath, "mock-thread"), userId: "tester" };
  const run = (name, inputs) => runtime.handleThreadMessage({
    ...input, text: `tool: ${name}\n${JSON.stringify(inputs)}`,
  });
  const progress = [];
  const operation = { type: "create_file", path: "notes with spaces.md", diff: "+Mock tool file content\n" };
  const created = await runtime.handleThreadMessage({
    ...input, text: `tool: apply_patch\n${JSON.stringify({ operation })}`,
    onAssistantProgress(payload) { progress.push(...payload.tools); },
  });
  assert.match(created.answer, /Tool result: apply_patch/);
  assert.equal(await fs.readFile(path.join(input.threadDir, "notes with spaces.md"), "utf8"), "Mock tool file content");
  assert.ok(progress.some((tool) => tool.name === "apply_patch" && tool.arguments.operation?.path === operation.path));
  await runtime.stop();
  const read = await run("read_document", { path: "notes with spaces.md" });
  assert.match(read.answer, /Mock tool file content/);
  await run("execute_command", { command: "mkdir -p archive && mv 'notes with spaces.md' 'archive/renamed notes.md'" });
  assert.match((await run("read_document", { path: "archive/renamed notes.md" })).answer, /Mock tool file content/);
  assert.match((await run("read_document", { path: "notes with spaces.md" })).answer, /File not found/);
  await runtime.stop();
  assert.equal((await runtime.handleThreadMessage({ ...input, text: "hello" })).answer, "Hey!");
  const events = (await fs.readFile(path.join(input.threadDir, "messages.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  const items = events.flatMap((event) => event.message?.items ?? []);
  const calls = items.filter((item) => item.type === "tool");
  const results = items.filter((item) => item.type === "tool-result");
  assert.equal(calls.length, 5);
  assert.equal(results.length, 5);
  assert.deepEqual(results.map((item) => item.callId), calls.map((item) => item.callId));
  assert.equal(new Set(calls.map((item) => item.callId)).size, 5);
});

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
