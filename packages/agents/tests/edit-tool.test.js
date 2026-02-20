import { after, before, describe, it } from "node:test";
import { ok, strictEqual } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createToolEditDocument } from "../src/tools/edit-tool.js";

describe("editTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-edit-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes and appends content", async () => {
    const tool = createToolEditDocument({ baseDir: tempDir });

    const write = await tool.handler({
      path: "doc.txt",
      operation: "write",
      content: "Hello",
    });
    strictEqual(write.status, "completed");

    const append = await tool.handler({
      path: "doc.txt",
      operation: "append",
      content: "\nWorld",
    });
    strictEqual(append.status, "completed");

    const content = await fs.promises.readFile(path.join(tempDir, "doc.txt"), "utf8");
    strictEqual(content, "Hello\nWorld");
  });

  it("replaces exact text", async () => {
    const tool = createToolEditDocument({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "replace.txt"), "A\nB\nC", "utf8");

    const result = await tool.handler({
      path: "replace.txt",
      operation: "replace",
      search: "B",
      replace: "Bee",
    });

    strictEqual(result.status, "completed");
    const content = await fs.promises.readFile(path.join(tempDir, "replace.txt"), "utf8");
    strictEqual(content, "A\nBee\nC");
  });

  it("fails replace when search text is missing", async () => {
    const tool = createToolEditDocument({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "missing.txt"), "Alpha", "utf8");

    const result = await tool.handler({
      path: "missing.txt",
      operation: "replace",
      search: "Beta",
      replace: "Gamma",
    });

    strictEqual(result.status, "failed");
    ok(result.output.includes("Search text not found"));
  });
});
