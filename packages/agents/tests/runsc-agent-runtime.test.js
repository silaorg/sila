import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  RunscAgentRuntime,
  assertRunscAvailable,
  readRunscConfiguration,
} from "../src/index.js";
import {
  buildRunscDockerArguments,
  validateWorkspaceMount,
} from "../src/runsc-agent-runtime.js";

const TEST_WORKER_PATH = fileURLToPath(
  new URL("./fixtures/test-worker.js", import.meta.url),
);

test("readRunscConfiguration requires an image and dedicated network", () => {
  assert.throws(
    () => readRunscConfiguration({}),
    /HESWE_WORKSPACE_IMAGE is required/,
  );
  assert.throws(
    () => readRunscConfiguration({ HESWE_WORKSPACE_IMAGE: "heswe:test" }),
    /HESWE_SANDBOX_NETWORK is required/,
  );
  assert.throws(
    () => readRunscConfiguration({
      HESWE_WORKSPACE_IMAGE: "heswe:test",
      HESWE_SANDBOX_NETWORK: "bridge",
    }),
    /dedicated Docker network/,
  );
  assert.deepEqual(
    readRunscConfiguration({
      HESWE_WORKSPACE_IMAGE: "heswe:test",
      HESWE_SANDBOX_NETWORK: "heswe-sandboxes",
    }),
    {
      dockerCommand: "docker",
      image: "heswe:test",
      network: "heswe-sandboxes",
      userId: "10001",
      groupId: "10001",
      cpus: "2",
      memory: "2g",
      pidsLimit: "256",
    },
  );
});

test("buildRunscDockerArguments creates a locked-down runsc container", () => {
  const args = buildRunscDockerArguments({
    workspaceId: "workspace-1",
    workspacePath: "/srv/heswe/workspaces/workspace-1",
    image: "heswe:test",
    network: "heswe-sandboxes",
    environment: { HESWE_AGENT_WORKER: "1" },
  });

  assert.deepEqual(args.slice(0, 5), [
    "run",
    "--rm",
    "--interactive",
    "--runtime",
    "runsc",
  ]);
  assert.ok(args.includes("--read-only"));
  assert.ok(args.includes("ALL"));
  assert.ok(args.includes("no-new-privileges=true"));
  assert.ok(args.includes("heswe-sandboxes"));
  assert.ok(args.includes("2g"));
  assert.ok(args.includes("256"));
  assert.ok(args.includes(
    "type=bind,source=/srv/heswe/workspaces/workspace-1,target=/workspace",
  ));
  assert.deepEqual(args.slice(-3), ["heswe:test", "--workspace", "/workspace"]);
});

test("validateWorkspaceMount accepts only the fixed direct workspace child", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-runsc-"));
  const workspacePath = path.join(root, "workspace-1");
  const nestedPath = path.join(workspacePath, "nested");
  await fs.mkdir(nestedPath, { recursive: true });

  assert.equal(
    validateWorkspaceMount({
      workspaceId: "workspace-1",
      workspacePath,
      workspaceRoot: root,
    }),
    workspacePath,
  );
  assert.throws(
    () => validateWorkspaceMount({
      workspaceId: "nested",
      workspacePath: nestedPath,
      workspaceRoot: root,
    }),
    /the fixed direct child/,
  );
});

test("assertRunscAvailable checks both runsc and the runtime image", async () => {
  const calls = [];
  await assertRunscAvailable({
    image: "heswe:test",
    network: "heswe-sandboxes",
    async execFile(command, args) {
      calls.push([command, args]);
      return args[0] === "info"
        ? { stdout: '{"io.containerd.runsc.v1":{},"runsc":{}}' }
        : { stdout: "[]" };
    },
  });

  assert.deepEqual(calls, [
    ["docker", ["info", "--format", "{{json .Runtimes}}"]],
    ["docker", ["image", "inspect", "heswe:test"]],
    ["docker", ["network", "inspect", "heswe-sandboxes"]],
  ]);
  await assert.rejects(
    assertRunscAvailable({
      image: "heswe:test",
      network: "heswe-sandboxes",
      async execFile() {
        return { stdout: '{"runc":{}}' };
      },
    }),
    /runsc is required/,
  );
});

test("RunscAgentRuntime maps paths and keeps API secrets out of Docker", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-runsc-"));
  const workspacePath = path.join(root, "workspace-1");
  const threadPath = path.join(workspacePath, "thread-1");
  await fs.mkdir(threadPath, { recursive: true });
  let launch;
  const runtime = new RunscAgentRuntime({
    workspaceId: "workspace-1",
    workspacePath,
    workspaceRoot: root,
    image: "heswe:test",
    network: "heswe-sandboxes",
    environment: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      OPENAI_API_KEY: "global-provider-key",
      BETTER_AUTH_SECRET: "platform-secret",
    },
    spawnProcess(command, args, options) {
      launch = { command, args, options };
      return spawn(process.execPath, [TEST_WORKER_PATH], {
        stdio: options.stdio,
      });
    },
  });

  const result = await runtime.handleThreadMessage({
    threadId: "thread-1",
    threadDir: threadPath,
    userId: "user-1",
    text: "Hello",
  });

  assert.equal(result.answer, "Hello");
  assert.equal(result.hasProviderKey, false);
  assert.equal(result.leakedApiSecret, false);
  assert.equal(launch.command, "docker");
  assert.equal(
    launch.args.some((value) => value.includes("global-provider-key")),
    false,
  );
  assert.equal(
    launch.args.some((value) => value.includes("platform-secret")),
    false,
  );
  assert.equal("OPENAI_API_KEY" in launch.options.env, false);
  assert.equal("BETTER_AUTH_SECRET" in launch.options.env, false);
  await runtime.stop();
});
