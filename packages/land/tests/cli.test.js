import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

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

test("create then run land succeeds", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-test-"));
  const landDir = path.join(tempRoot, "good-land");

  const createResult = await runCli([
    "create",
    landDir,
    "--channel",
    "slack",
    "--openai-api-key",
    "sk-test",
  ]);
  assert.equal(createResult.code, 0);
  assert.match(createResult.stdout, /Created land at:/);
  const skillsStat = await fs.stat(path.join(landDir, "skills"));
  assert.equal(skillsStat.isDirectory(), true);

  const runResult = await runCli(["run", landDir]);
  assert.equal(runResult.code, 0);
  assert.match(runResult.stdout, /Starting Slack channel at:/);
  assert.match(runResult.stdout, /Running land:/);
});

test("create and run return errors for invalid paths", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-test-"));

  const existingLandDir = path.join(tempRoot, "existing-land");
  await fs.mkdir(existingLandDir, { recursive: true });
  await fs.writeFile(path.join(existingLandDir, "config.json"), "{\"version\":1,\"name\":\"x\"}\n", "utf8");

  const createExistingResult = await runCli(["create", existingLandDir]);
  assert.equal(createExistingResult.code, 2);
  assert.match(createExistingResult.stderr, /Land already exists at/);

  const badRunDir = path.join(tempRoot, "bad-run-land");
  await fs.mkdir(badRunDir, { recursive: true });
  await fs.writeFile(path.join(badRunDir, "README.txt"), "hello\n", "utf8");

  const runMissingConfigResult = await runCli(["run", badRunDir]);
  assert.equal(runMissingConfigResult.code, 2);
  assert.match(runMissingConfigResult.stderr, /Missing config\.json in non-empty directory/);
});
