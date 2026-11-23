import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { CreateWorkspaceError, createWorkspace } from "../src/create-workspace.js";

const execFileAsync = promisify(execFile);
const testsDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testsDir, "../src/cli.js");

async function runCli(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...args], {
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return {
      code: Number(error.code ?? 1),
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

test("concurrent workspace creators cannot mix their channel configurations", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-test-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  const workspacePath = path.join(tempRoot, "nested", "workspace");

  const results = await Promise.allSettled(["slack", "telegram"].map(
    (channel) => createWorkspace({ path: workspacePath, channel }),
  ));
  const created = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(created.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof CreateWorkspaceError);
  assert.deepEqual(await fs.readdir(path.join(workspacePath, "channels")), [created[0].value.channel]);
});

test("create then run workspace succeeds", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-test-"));
  const workspaceDir = path.join(tempRoot, "good-workspace");

  const createResult = await runCli([
    "create",
    workspaceDir,
    "--channel",
    "slack",
    "--openai-api-key",
    "sk-test",
    "--secret",
    "EXAMPLE=test-value",
  ]);
  assert.equal(createResult.code, 0);
  assert.match(createResult.stdout, /Created workspace at:/);
  const workspaceEnv = await fs.readFile(path.join(workspaceDir, ".env"), "utf8");
  assert.match(workspaceEnv, /OPENAI_API_KEY=sk-test/);
  assert.match(workspaceEnv, /ANTHROPIC_API_KEY=/);
  assert.match(workspaceEnv, /GOOGLE_API_KEY=/);
  assert.match(workspaceEnv, /KIMI_API_KEY=/);
  assert.match(workspaceEnv, /XAI_API_KEY=/);
  assert.match(workspaceEnv, /OPENROUTER_API_KEY=/);
  assert.match(workspaceEnv, /DEEPSEEK_API_KEY=/);
  assert.match(workspaceEnv, /GROQ_API_KEY=/);
  assert.match(workspaceEnv, /COHERE_API_KEY=/);
  assert.match(workspaceEnv, /MISTRAL_API_KEY=/);
  assert.match(workspaceEnv, /FAL_KEY=/);
  assert.match(workspaceEnv, /EXA_API_KEY=/);
  const secrets = JSON.parse(await fs.readFile(path.join(workspaceDir, "secrets.json"), "utf8"));
  assert.deepEqual(secrets, [{ name: "EXAMPLE", value: "test-value" }]);
  if (process.platform !== "win32") {
    for (const file of [".env", "secrets.json", "channels/slack/config.json"]) {
      assert.equal((await fs.stat(path.join(workspaceDir, file))).mode & 0o777, 0o600, file);
    }
  }
  const skillsStat = await fs.stat(path.join(workspaceDir, "skills"));
  assert.equal(skillsStat.isDirectory(), true);
  const defaultAgentConfig = JSON.parse(await fs.readFile(path.join(workspaceDir, "agents", "default", "config.json"), "utf8"));
  assert.equal(defaultAgentConfig.provider, "auto");
  assert.equal(defaultAgentConfig.model, "auto");
  const providerConfig = JSON.parse(await fs.readFile(path.join(workspaceDir, "providers", "openai", "config.json"), "utf8"));
  assert.equal(providerConfig.provider, "openai");
  assert.equal(providerConfig.enabled, true);

  const runResult = await runCli(["run", workspaceDir]);
  assert.equal(runResult.code, 0);
  assert.match(runResult.stdout, /Default agent language model: openai\/gpt-5\.4/);
  assert.match(runResult.stdout, /Starting Slack channel at:/);
  assert.match(runResult.stdout, /Running workspace:/);
});

test("create then run workspace with default Telegram channel succeeds", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-test-"));
  const workspaceDir = path.join(tempRoot, "telegram-workspace");

  const createResult = await runCli(["create", workspaceDir, "--openai-api-key", "sk-test"]);
  assert.equal(createResult.code, 0);
  assert.match(createResult.stdout, /Scaffolded channel: telegram/);

  const runResult = await runCli(["run", workspaceDir]);
  assert.equal(runResult.code, 0);
  assert.match(runResult.stdout, /Default agent language model: openai\/gpt-5\.4/);
  assert.match(runResult.stdout, /Starting Telegram channel at:/);
  assert.match(runResult.stdout, /Telegram channel missing bot token/);
  assert.match(runResult.stdout, /Running workspace:/);
});

test("create explains the secret format without echoing the supplied value", async () => {
  const result = await runCli(["create", "--secret", "private-test-value"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /--secret.*NAME=VALUE/);
  assert.doesNotMatch(result.stderr + result.stdout, /private-test-value/);
});

test("create and run return errors for invalid paths", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-test-"));

  const existingWorkspaceDir = path.join(tempRoot, "existing-workspace");
  await fs.mkdir(existingWorkspaceDir, { recursive: true });
  await fs.writeFile(path.join(existingWorkspaceDir, "config.json"), "{\"version\":1,\"name\":\"x\"}\n", "utf8");

  const createExistingResult = await runCli(["create", existingWorkspaceDir]);
  assert.equal(createExistingResult.code, 2);
  assert.match(createExistingResult.stderr, /Workspace already exists at/);

  const badRunDir = path.join(tempRoot, "bad-run-workspace");
  await fs.mkdir(badRunDir, { recursive: true });
  await fs.writeFile(path.join(badRunDir, "README.txt"), "hello\n", "utf8");

  const runMissingConfigResult = await runCli(["run", badRunDir]);
  assert.equal(runMissingConfigResult.code, 2);
  assert.match(runMissingConfigResult.stderr, /Missing config\.json in non-empty directory/);

  const unsupportedChannelResult = await runCli([
    "create",
    path.join(tempRoot, "unsupported-channel"),
    "--channel",
    "email",
  ]);
  assert.equal(unsupportedChannelResult.code, 2);
  assert.match(unsupportedChannelResult.stderr, /channel.*Invalid option/i);
});
