import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { WorkspaceRegistry } from "../src/lib/server/workspace-registry.js";

async function createRegistry() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-registry-"));
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  return {
    root,
    registry: new WorkspaceRegistry({
      database,
      workspacesPath: path.join(root, "workspaces"),
    }),
  };
}

test("users start without a workspace and cannot see another user's workspaces", async () => {
  const { registry } = await createRegistry();

  assert.deepEqual(await registry.list("user-a"), []);

  const created = await registry.create("user-a", { name: "Personal" });
  assert.equal(created.name, "Personal");
  assert.equal(created.isCurrent, true);
  assert.deepEqual(await registry.list("user-b"), []);
  await assert.rejects(
    registry.select("user-b", created.id),
    /Workspace not found/,
  );
});

test("creating a workspace scaffolds it and selects it for that user", async () => {
  const { registry } = await createRegistry();

  const first = await registry.create("user-a", { name: "Personal" });
  const firstCurrent = await registry.get("user-a", first.id);
  assert.ok(firstCurrent);
  assert.equal(firstCurrent.id, first.id);
  assert.equal(firstCurrent.name, "Personal");
  assert.equal(
    path.basename(firstCurrent.workspacePath),
    first.id,
  );
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(firstCurrent.workspacePath, "config.json"), "utf8"),
    ),
    { version: 1, name: "Personal" },
  );
  assert.equal(
    (
      await fs.stat(
        path.join(firstCurrent.workspacePath, "providers", "openai", "config.json"),
      )
    ).isFile(),
    true,
  );

  const second = await registry.create("user-a", { name: "Work" });
  const secondCurrent = await registry.get("user-a", second.id);
  assert.ok(secondCurrent);
  assert.equal(secondCurrent.id, second.id);
  const listed = await registry.list("user-a");
  assert.deepEqual(
    listed.map(({ name, isCurrent }) => ({ name, isCurrent })),
    [
      { name: "Personal", isCurrent: false },
      { name: "Work", isCurrent: true },
    ],
  );
  assert.equal("workspacePath" in listed[0], false);

  await registry.select("user-a", first.id);
  const selected = await registry.list("user-a");
  assert.equal(selected.find((workspace) => workspace.isCurrent)?.id, first.id);
});

test("workspace creation validates names and rejects duplicates per user", async () => {
  const { registry } = await createRegistry();

  await assert.rejects(
    registry.create("user-a", { name: "  " }),
    /Workspace name is required/,
  );
  await registry.create("user-a", { name: "Research" });
  await assert.rejects(
    registry.create("user-a", { name: "research" }),
    /already exists/,
  );

  const otherUsersWorkspace = await registry.create("user-b", { name: "Research" });
  assert.equal(otherUsersWorkspace.name, "Research");
});
