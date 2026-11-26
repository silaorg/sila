import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadWorkspaceTools } from "../src/tools.js";

test("loadWorkspaceTools loads packaged tools and passes runtime context", async () => {
  const workspacePath = await createWorkspaceWithTools();
  const toolDirPath = path.join(workspacePath, "tools", "echo-tool");

  await fs.mkdir(toolDirPath, { recursive: true });
  await fs.writeFile(
    path.join(toolDirPath, "package.json"),
    JSON.stringify({
      name: "@test/echo-tool",
      private: true,
      type: "module",
      main: "./index.js",
    }, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(toolDirPath, "index.js"),
    [
      "export function createTool(context) {",
      "  return {",
      "    name: 'echo_tool',",
      "    description: `Echo for ${context.channel}:${context.threadId}`,",
      "    parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },",
      "    async handler({ value }) {",
      "      return { value, threadDir: context.threadDir, sourcePath: context.sourcePath };",
      "    },",
      "  };",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  const tools = await loadWorkspaceTools(workspacePath, {
    channel: "telegram",
    threadId: "thread-42",
    threadDir: path.join(workspacePath, "channels", "telegram", "thread-42"),
    sourcePath: "/repo/source",
  });

  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "echo_tool");
  assert.equal(tools[0].description, "Echo for telegram:thread-42");
  assert.deepEqual(await tools[0].handler({ value: "hello" }), {
    value: "hello",
    threadDir: path.join(workspacePath, "channels", "telegram", "thread-42"),
    sourcePath: "/repo/source",
  });
});

test("loadWorkspaceTools skips duplicate and built-in tool names", async () => {
  const workspacePath = await createWorkspaceWithTools();
  const warnings = [];

  await writeToolPackage(workspacePath, "custom-one", "duplicate_name");
  await writeToolPackage(workspacePath, "custom-two", "duplicate_name");
  await writeToolPackage(workspacePath, "built-in-name", "read_document");
  await writeToolPackage(workspacePath, "conditional-built-in-name", "send_slack_file");

  const tools = await loadWorkspaceTools(workspacePath, {
    logger: {
      warn(message) {
        warnings.push(message);
      },
    },
  });

  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "duplicate_name");
  assert.match(warnings.join("\n"), /duplicate tool name "duplicate_name"/);
  assert.match(warnings.join("\n"), /collides with a built-in tool/);
});

test("a factory rejection without a reason leaves other tools available", async (t) => {
  const workspacePath = await createWorkspaceWithTools();
  t.after(() => fs.rm(path.dirname(workspacePath), { recursive: true, force: true }));
  const broken = path.join(workspacePath, "tools", "broken");
  await fs.mkdir(broken);
  await fs.writeFile(path.join(broken, "package.json"), JSON.stringify({ type: "module" }));
  await fs.writeFile(path.join(broken, "index.js"), "export default () => Promise.reject();");
  await writeToolPackage(workspacePath, "healthy", "healthy");
  const warn = t.mock.fn();

  const tools = await loadWorkspaceTools(workspacePath, { logger: { warn } });

  assert.deepEqual(tools.map((tool) => tool.name), ["healthy"]);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /Skipping tool package .*broken/);
});

test("loadWorkspaceTools reloads tool modules after edits", async () => {
  const workspacePath = await createWorkspaceWithTools();
  const toolDirPath = path.join(workspacePath, "tools", "dynamic-tool");
  await fs.mkdir(toolDirPath, { recursive: true });
  await fs.writeFile(
    path.join(toolDirPath, "package.json"),
    JSON.stringify({
      name: "@test/dynamic-tool",
      private: true,
      type: "module",
      main: "./index.js",
    }, null, 2),
    "utf8",
  );

  await writeDynamicToolEntry(toolDirPath, "first version");
  const firstLoad = await loadWorkspaceTools(workspacePath);

  await waitForMtimeTick();
  await writeDynamicToolEntry(toolDirPath, "second version");
  const secondLoad = await loadWorkspaceTools(workspacePath);

  assert.equal(firstLoad[0].description, "first version");
  assert.equal(secondLoad[0].description, "second version");
});

async function createWorkspaceWithTools() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-tools-"));
  const workspacePath = path.join(root, "workspace");
  await fs.mkdir(path.join(workspacePath, "tools"), { recursive: true });
  return workspacePath;
}

async function writeToolPackage(workspacePath, directoryName, toolName) {
  const toolDirPath = path.join(workspacePath, "tools", directoryName);
  await fs.mkdir(toolDirPath, { recursive: true });
  await fs.writeFile(
    path.join(toolDirPath, "package.json"),
    JSON.stringify({
      name: `@test/${directoryName}`,
      private: true,
      type: "module",
      main: "./index.js",
    }, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(toolDirPath, "index.js"),
    [
      "export default {",
      `  name: '${toolName}',`,
      "  description: 'Test tool',",
      "  parameters: { type: 'object', properties: {} },",
      "  async handler() {",
      "    return { ok: true };",
      "  },",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function writeDynamicToolEntry(toolDirPath, description) {
  await fs.writeFile(
    path.join(toolDirPath, "index.js"),
    [
      "export default {",
      "  name: 'dynamic_tool',",
      `  description: '${description}',`,
      "  parameters: { type: 'object', properties: {} },",
      "  async handler() {",
      "    return { ok: true };",
      "  },",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function waitForMtimeTick() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}
