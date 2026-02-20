import { after, before, describe, it } from "node:test";
import { ok, strictEqual } from "node:assert";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createToolReadDocument } from "../src/tools/read-tool.js";

describe("readTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-read-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reads a local text file", async () => {
    const tool = createToolReadDocument({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "sample.txt"), "Hello World\nLine 2", "utf8");

    const result = await tool.handler({ path: "sample.txt" });
    strictEqual(result.type, "text");
    strictEqual(result.totalLines, 2);
    strictEqual(result.content, "Hello World\nLine 2");
  });

  it("reads a specific range of lines", async () => {
    const tool = createToolReadDocument({ baseDir: tempDir });
    const content = Array.from({ length: 10 }, (_, index) => `Line ${index + 1}`).join("\n");
    await fs.promises.writeFile(path.join(tempDir, "range.txt"), content, "utf8");

    const result = await tool.handler({ path: "range.txt", start: 2, limit: 3 });
    strictEqual(result.content, "Line 3\nLine 4\nLine 5");
  });

  it("returns error for missing file", async () => {
    const tool = createToolReadDocument({ baseDir: tempDir });
    const result = await tool.handler({ path: "missing.txt" });
    ok(result.error);
    ok(result.error.includes("File not found"));
  });

  it("reads and strips basic HTML from a URL", async () => {
    const tool = createToolReadDocument({ baseDir: tempDir });

    const server = http.createServer((_, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body><h1>Hello</h1><p>world</p></body></html>");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const result = await tool.handler({ path: `http://127.0.0.1:${port}/` });

    await new Promise((resolve) => server.close(resolve));

    strictEqual(result.type, "url");
    ok(result.content.includes("Hello world"));
  });
});
