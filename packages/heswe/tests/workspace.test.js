import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Workspace } from "../src/workspace.js";

test("Workspace.run rejects invalid config instead of running with an undefined name", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-workspace-"));
  await fs.writeFile(path.join(workspacePath, "config.json"), "{invalid", "utf8");

  const workspace = new Workspace(workspacePath);
  await assert.rejects(workspace.run(), /Invalid JSON/);
  await assert.rejects(workspace.run(), /Invalid JSON/);
  assert.equal(workspace.name, "");
});

test("Workspace.run rejects malformed channel config instead of silently skipping it", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-workspace-"));
  const channelPath = path.join(workspacePath, "channels", "slack");
  await fs.mkdir(channelPath, { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, "config.json"),
    `${JSON.stringify({ version: 1, name: "broken-channel" })}\n`,
    "utf8",
  );
  await fs.writeFile(path.join(channelPath, "config.json"), "{invalid", "utf8");

  const workspace = new Workspace(workspacePath);
  await assert.rejects(workspace.run(), /Invalid JSON.*channels.*slack/);
});
