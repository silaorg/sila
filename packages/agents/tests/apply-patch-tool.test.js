import { after, before, describe, it } from "node:test";
import { ok, strictEqual } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createToolApplyPatch } from "../src/tools/apply-patch-tool.js";

describe("applyPatchTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-apply-patch-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("creates a file using create_file operation", async () => {
    const tool = createToolApplyPatch({ baseDir: tempDir });

    const result = await tool.handler({
      operation: {
        type: "create_file",
        path: "create.txt",
        diff: "+Hello\n+World",
      },
    });

    strictEqual(result.status, "completed");
    const content = await fs.promises.readFile(path.join(tempDir, "create.txt"), "utf8");
    strictEqual(content, "Hello\nWorld");
  });

  it("updates an existing file using update_file operation", async () => {
    const tool = createToolApplyPatch({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "update.txt"), "Line 1\nLine 2\nLine 3", "utf8");

    const result = await tool.handler({
      operation: {
        type: "update_file",
        path: "update.txt",
        diff: "-Line 2\n+Line Two",
      },
    });

    strictEqual(result.status, "completed");
    const content = await fs.promises.readFile(path.join(tempDir, "update.txt"), "utf8");
    strictEqual(content, "Line 1\nLine Two\nLine 3");
  });

  it("deletes a file using delete_file operation", async () => {
    const tool = createToolApplyPatch({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "delete.txt"), "To delete", "utf8");

    const result = await tool.handler({
      operation: {
        type: "delete_file",
        path: "delete.txt",
      },
    });

    strictEqual(result.status, "completed");
    strictEqual(fs.existsSync(path.join(tempDir, "delete.txt")), false);
  });

  it("fails when update_file target does not exist", async () => {
    const tool = createToolApplyPatch({ baseDir: tempDir });
    const result = await tool.handler({
      operation: {
        type: "update_file",
        path: "missing.txt",
        diff: "-old\n+new",
      },
    });

    strictEqual(result.status, "failed");
    ok(result.output.includes("File not found"));
  });
});
