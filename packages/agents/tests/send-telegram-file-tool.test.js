import { describe, it } from "node:test";
import { deepEqual, strictEqual } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createToolSendTelegramFile } from "../src/tools/send-telegram-file-tool.js";

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sila-send-telegram-file-"));
  const assetsDir = path.join(root, "assets");
  await fs.mkdir(assetsDir, { recursive: true });
  return { root, assetsDir };
}

describe("createToolSendTelegramFile", () => {
  it("infers kind and calls sender for files in ./assets", async () => {
    const fixture = await createFixture();
    const relativePath = path.join("assets", "images", "sample.png");
    const fullPath = path.join(fixture.root, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "png", "utf8");

    let payload;
    const tool = createToolSendTelegramFile(
      async (input) => {
        payload = input;
        return { messageId: 77 };
      },
      { baseDir: fixture.root },
    );

    const result = await tool.handler({
      path: relativePath,
      kind: "auto",
      caption: "file ready",
    });

    deepEqual(payload, {
      path: fullPath,
      kind: "photo",
      caption: "file ready",
    });
    strictEqual(result.status, "sent");
    strictEqual(result.kind, "photo");
    strictEqual(result.file, relativePath);
    deepEqual(result.result, { messageId: 77 });
  });

  it("allows sending files outside assets", async () => {
    const fixture = await createFixture();
    const outsidePath = path.join(fixture.root, "notes.txt");
    await fs.writeFile(outsidePath, "test", "utf8");

    let payload;
    const tool = createToolSendTelegramFile(async () => ({ messageId: 1 }), { baseDir: fixture.root });
    const result = await tool.handler({ path: outsidePath });
    strictEqual(result.status, "sent");
    strictEqual(result.file, outsidePath);

    const toolWithCapture = createToolSendTelegramFile(
      async (input) => {
        payload = input;
        return { messageId: 2 };
      },
      { baseDir: fixture.root },
    );
    await toolWithCapture.handler({ path: outsidePath });
    strictEqual(payload.path, outsidePath);
  });

  it("returns missing file error", async () => {
    const fixture = await createFixture();
    const tool = createToolSendTelegramFile(async () => ({ messageId: 1 }), { baseDir: fixture.root });

    const result = await tool.handler({ path: "assets/missing.txt" });
    strictEqual(result.error, "File not found: assets/missing.txt");
  });

  it("accepts thread-relative paths", async () => {
    const fixture = await createFixture();
    const threadDir = path.join(fixture.root, "channels", "telegram", "thread-1");
    await fs.mkdir(threadDir, { recursive: true });

    const relativePath = path.join("..", "..", "..", "assets", "docs", "guide.txt");
    const fullPath = path.join(fixture.root, "assets", "docs", "guide.txt");
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "guide", "utf8");

    let payload;
    const tool = createToolSendTelegramFile(
      async (input) => {
        payload = input;
        return { messageId: 88 };
      },
      { baseDir: threadDir },
    );

    const result = await tool.handler({ path: relativePath, kind: "auto" });
    deepEqual(payload, {
      path: fullPath,
      kind: "document",
      caption: undefined,
    });
    strictEqual(result.status, "sent");
    strictEqual(result.file, relativePath);
  });
});
