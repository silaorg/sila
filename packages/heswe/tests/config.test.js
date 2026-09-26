import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createDefaultConfig, readConfig } from "../src/config.js";

test("createDefaultConfig accepts a display name independent of the directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-config-"));
  const workspacePath = path.join(root, "opaque-id");
  await fs.mkdir(workspacePath);

  const created = await createDefaultConfig(workspacePath, { name: "Research" });

  assert.deepEqual(created, { version: 1, name: "Research" });
  assert.deepEqual(await readConfig(workspacePath), created);
});
