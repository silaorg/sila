import { after, before, describe, it } from "node:test";
import { ok, strictEqual } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createToolSearchReplacePatch } from "../src/tools/patch-tool.js";

describe("patchTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-patch-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("creates a file when target does not exist", async () => {
    const tool = createToolSearchReplacePatch({ baseDir: tempDir });
    const result = await tool.handler({
      patch: `
newfile.txt
<<<<<<< SEARCH
=======
Hello World
>>>>>>> REPLACE
`,
    });
    strictEqual(result.status, "completed");

    const content = await fs.promises.readFile(path.join(tempDir, "newfile.txt"), "utf8");
    strictEqual(content, "Hello World");
  });

  it("replaces content in an existing file", async () => {
    const tool = createToolSearchReplacePatch({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "existing.txt"), "Line 1\nLine 2\nLine 3", "utf8");

    const result = await tool.handler({
      patch: `
existing.txt
<<<<<<< SEARCH
Line 2
=======
Line Two
>>>>>>> REPLACE
`,
    });
    strictEqual(result.status, "completed");

    const content = await fs.promises.readFile(path.join(tempDir, "existing.txt"), "utf8");
    strictEqual(content, "Line 1\nLine Two\nLine 3");
  });

  it("fails when search block is not found", async () => {
    const tool = createToolSearchReplacePatch({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "fail.txt"), "Hello", "utf8");

    const result = await tool.handler({
      patch: `
fail.txt
<<<<<<< SEARCH
Goodbye
=======
Hi
>>>>>>> REPLACE
`,
    });
    strictEqual(result.status, "failed");
    ok(result.output.includes("SEARCH block not found"));
  });

  it("handles multiple files in one patch", async () => {
    const tool = createToolSearchReplacePatch({ baseDir: tempDir });
    const result = await tool.handler({
      patch: `
multi1.txt
<<<<<<< SEARCH
=======
File 1 Content
>>>>>>> REPLACE
multi2.txt
<<<<<<< SEARCH
=======
File 2 Content
>>>>>>> REPLACE
`,
    });
    strictEqual(result.status, "completed");

    const content1 = await fs.promises.readFile(path.join(tempDir, "multi1.txt"), "utf8");
    strictEqual(content1, "File 1 Content");

    const content2 = await fs.promises.readFile(path.join(tempDir, "multi2.txt"), "utf8");
    strictEqual(content2, "File 2 Content");
  });
});
