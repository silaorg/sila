import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadLandTools } from "../src/tools.js";

test("loadLandTools loads packaged tools and passes runtime context", async () => {
  const landPath = await createLandWithTools();
  const toolDirPath = path.join(landPath, "tools", "echo-tool");

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

  const tools = await loadLandTools(landPath, {
    channel: "telegram",
    threadId: "thread-42",
    threadDir: path.join(landPath, "channels", "telegram", "thread-42"),
    sourcePath: "/repo/source",
  });

  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "echo_tool");
  assert.equal(tools[0].description, "Echo for telegram:thread-42");
  assert.deepEqual(await tools[0].handler({ value: "hello" }), {
    value: "hello",
    threadDir: path.join(landPath, "channels", "telegram", "thread-42"),
    sourcePath: "/repo/source",
  });
});

test("loadLandTools skips duplicate and built-in tool names", async () => {
  const landPath = await createLandWithTools();
  const warnings = [];

  await writeToolPackage(landPath, "custom-one", "duplicate_name");
  await writeToolPackage(landPath, "custom-two", "duplicate_name");
  await writeToolPackage(landPath, "built-in-name", "read_document");

  const tools = await loadLandTools(landPath, {
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

test("loadLandTools reloads tool modules after edits", async () => {
  const landPath = await createLandWithTools();
  const toolDirPath = path.join(landPath, "tools", "dynamic-tool");
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
  const firstLoad = await loadLandTools(landPath);

  await waitForMtimeTick();
  await writeDynamicToolEntry(toolDirPath, "second version");
  const secondLoad = await loadLandTools(landPath);

  assert.equal(firstLoad[0].description, "first version");
  assert.equal(secondLoad[0].description, "second version");
});

async function createLandWithTools() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-tools-"));
  const landPath = path.join(root, "land");
  await fs.mkdir(path.join(landPath, "tools"), { recursive: true });
  return landPath;
}

async function writeToolPackage(landPath, directoryName, toolName) {
  const toolDirPath = path.join(landPath, "tools", directoryName);
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
