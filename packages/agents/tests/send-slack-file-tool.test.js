import { describe, it } from "node:test";
import { deepEqual, strictEqual } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createToolSendSlackFile } from "../src/tools/send-slack-file-tool.js";

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sila-send-slack-file-"));
  const assetsDir = path.join(root, "assets");
  await fs.mkdir(assetsDir, { recursive: true });
  return { root, assetsDir };
}

describe("createToolSendSlackFile", () => {
  it("uploads file with optional title and comment", async () => {
    const fixture = await createFixture();
    const relativePath = path.join("assets", "images", "diagram.png");
    const fullPath = path.join(fixture.root, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "png", "utf8");

    let payload;
    const tool = createToolSendSlackFile(
      async (input) => {
        payload = input;
        return { fileId: "F123" };
      },
      { baseDir: fixture.root },
    );

    const result = await tool.handler({
      path: relativePath,
      title: "Architecture",
      comment: "Here is the latest version.",
    });

    deepEqual(payload, {
      path: fullPath,
      title: "Architecture",
      comment: "Here is the latest version.",
    });
    strictEqual(result.status, "sent");
    strictEqual(result.file, relativePath);
    deepEqual(result.result, { fileId: "F123" });
  });

  it("returns missing file error", async () => {
    const fixture = await createFixture();
    const tool = createToolSendSlackFile(async () => ({ fileId: "F1" }), { baseDir: fixture.root });

    const result = await tool.handler({ path: "assets/missing.txt" });
    strictEqual(result.error, "File not found: assets/missing.txt");
  });

  it("uploads multiple files using paths", async () => {
    const fixture = await createFixture();
    const relOne = path.join("assets", "docs", "one.txt");
    const relTwo = path.join("assets", "docs", "two.txt");
    const fullOne = path.join(fixture.root, relOne);
    const fullTwo = path.join(fixture.root, relTwo);
    await fs.mkdir(path.dirname(fullOne), { recursive: true });
    await fs.writeFile(fullOne, "one", "utf8");
    await fs.writeFile(fullTwo, "two", "utf8");

    let payload;
    const tool = createToolSendSlackFile(
      async (input) => {
        payload = input;
        return { fileIds: ["F1", "F2"] };
      },
      { baseDir: fixture.root },
    );

    const result = await tool.handler({
      paths: [relOne, relTwo],
      comment: "batch upload",
    });

    deepEqual(payload, {
      files: [
        { path: fullOne, filename: "one.txt" },
        { path: fullTwo, filename: "two.txt" },
      ],
      comment: "batch upload",
    });
    strictEqual(result.status, "sent");
    deepEqual(result.files, [relOne, relTwo]);
    deepEqual(result.result, { fileIds: ["F1", "F2"] });
  });

  it("accepts thread-relative paths", async () => {
    const fixture = await createFixture();
    const threadDir = path.join(fixture.root, "channels", "slack", "thread-1");
    await fs.mkdir(threadDir, { recursive: true });

    const relativePath = path.join("..", "..", "..", "assets", "docs", "guide.txt");
    const fullPath = path.join(fixture.root, "assets", "docs", "guide.txt");
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "guide", "utf8");

    let payload;
    const tool = createToolSendSlackFile(
      async (input) => {
        payload = input;
        return { fileId: "F88" };
      },
      { baseDir: threadDir },
    );

    const result = await tool.handler({ path: relativePath });
    deepEqual(payload, {
      path: fullPath,
      title: undefined,
      comment: undefined,
    });
    strictEqual(result.status, "sent");
    strictEqual(result.file, relativePath);
  });

  it("returns validation error when path and paths are both provided", async () => {
    const fixture = await createFixture();
    const fullPath = path.join(fixture.root, "assets", "mixed.txt");
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "mixed", "utf8");

    const tool = createToolSendSlackFile(async () => ({ fileId: "F1" }), { baseDir: fixture.root });
    const result = await tool.handler({ path: "assets/mixed.txt", paths: ["assets/mixed.txt"] });
    strictEqual(result.error, "Use either path or paths, not both.");
  });
});
