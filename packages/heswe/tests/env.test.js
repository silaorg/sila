import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  readWorkspaceEnvValue,
  updateWorkspaceEnvironment,
} from "../src/env.js";

test("workspace environment values override server fallbacks", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-env-"));
  await fs.writeFile(
    path.join(workspacePath, ".env"),
    "OPENAI_API_KEY=workspace-key\n",
    "utf8",
  );
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "server-key";
  try {
    assert.equal(
      await readWorkspaceEnvValue(workspacePath, "OPENAI_API_KEY"),
      "workspace-key",
    );
  } finally {
    if (typeof previous === "string") {
      process.env.OPENAI_API_KEY = previous;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
});

test("workspace environment updates preserve unrelated values and remove keys", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-env-"));
  const envPath = path.join(workspacePath, ".env");
  await fs.writeFile(
    envPath,
    "# Workspace settings\nOPENAI_API_KEY=old\nEXA_API_KEY=keep\n",
    "utf8",
  );

  await updateWorkspaceEnvironment(workspacePath, {
    OPENAI_API_KEY: "new key",
    ANTHROPIC_API_KEY: "anthropic-key",
  });
  assert.equal(
    await fs.readFile(envPath, "utf8"),
    [
      "# Workspace settings",
      'OPENAI_API_KEY="new key"',
      "EXA_API_KEY=keep",
      'ANTHROPIC_API_KEY="anthropic-key"',
      "",
    ].join("\n"),
  );

  await updateWorkspaceEnvironment(workspacePath, {
    OPENAI_API_KEY: null,
  });
  const updated = await fs.readFile(envPath, "utf8");
  assert.doesNotMatch(updated, /OPENAI_API_KEY/);
  assert.match(updated, /EXA_API_KEY=keep/);
  assert.equal((await fs.stat(envPath)).mode & 0o777, 0o600);
});
