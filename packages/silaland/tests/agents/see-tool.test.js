import { after, before, describe, it } from "node:test";
import { ok, strictEqual } from "node:assert";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { LangMessages } from "aiwrapper";
import { createToolSeeImage } from "../../src/agent-runtime/tools/see-tool.js";

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aB8AAAAASUVORK5CYII=";

function createVisionLang(answerText = "A tiny pixel image.") {
  return {
    async chat(messages) {
      const result = messages instanceof LangMessages
        ? messages
        : new LangMessages(messages);
      result.addAssistantMessage(answerText);
      return result;
    },
  };
}

describe("seeTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-see-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("registers with name see", () => {
    const see = createToolSeeImage({ lang: createVisionLang() });
    strictEqual(see.name, "see");
  });

  it("describes a local image file", async () => {
    const tool = createToolSeeImage({
      lang: createVisionLang("A single bright pixel."),
      baseDir: tempDir,
    });

    await fs.promises.writeFile(
      path.join(tempDir, "pixel.png"),
      Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"),
    );

    const result = await tool.handler({ uri: "pixel.png", prompt: "Describe what you see." });
    strictEqual(result.mimeType, "image/png");
    strictEqual(result.description, "A single bright pixel.");
    ok(result.uri.endsWith(`${path.sep}pixel.png`));
  });

  it("describes an image URL", async () => {
    const tool = createToolSeeImage({ lang: createVisionLang("A tiny PNG image.") });

    const server = http.createServer((_, response) => {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const result = await tool.handler({ uri: `http://127.0.0.1:${port}/pixel.png` });

    await new Promise((resolve) => server.close(resolve));

    strictEqual(result.mimeType, "image/png");
    strictEqual(result.description, "A tiny PNG image.");
    strictEqual(result.uri, `http://127.0.0.1:${port}/pixel.png`);
  });

  it("returns error for non-image files", async () => {
    const tool = createToolSeeImage({ lang: createVisionLang(), baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "not-image.txt"), "hello", "utf8");

    const result = await tool.handler({ uri: "not-image.txt" });
    ok(result.error);
    ok(result.error.includes("does not appear to be an image"));
  });
});
