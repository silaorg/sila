import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createToolGenerateImage } from "../src/tools/generate-image-tool.js";

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aB8AAAAASUVORK5CYII=";

function createMockBinaryResponse(bytes, contentType) {
  const payload = Uint8Array.from(bytes);
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {
      get(name) {
        return String(name || "").toLowerCase() === "content-type" ? contentType : null;
      },
    },
    async arrayBuffer() {
      return payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
    },
  };
}

describe("generateImageTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sila-agents-generate-image-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns a clear error when FAL_AI_API_KEY is missing", async () => {
    const previous = process.env.FAL_AI_API_KEY;
    delete process.env.FAL_AI_API_KEY;

    try {
      const tool = createToolGenerateImage({
        baseDir: tempDir,
        falClient: {
          config() {},
          async subscribe() {
            throw new Error("Should not be called");
          },
        },
      });

      const result = await tool.handler({ prompt: "a lighthouse at sunset" });
      assert.equal(result.status, "failed");
      assert.match(result.message, /FAL_AI_API_KEY/i);
    } finally {
      restoreEnv("FAL_AI_API_KEY", previous);
    }
  });

  it("generates an image with the text-to-image model", async () => {
    const previous = process.env.FAL_AI_API_KEY;
    process.env.FAL_AI_API_KEY = "fal-test-key";

    const calls = {
      config: null,
      subscribe: null,
    };

    const tool = createToolGenerateImage({
      baseDir: tempDir,
      falClient: {
        config(args) {
          calls.config = args;
        },
        async subscribe(modelId, args) {
          calls.subscribe = { modelId, args };
          return {
            data: {
              images: [{ url: "https://example.test/generated.png" }],
            },
          };
        },
      },
      fetchImpl: async (url) => {
        assert.equal(url, "https://example.test/generated.png");
        return createMockBinaryResponse(Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"), "image/png");
      },
    });

    try {
      const result = await tool.handler({ prompt: "a tiny red dot" });
      assert.equal(result.status, "completed");
      assert.equal(result.files.length, 1);
      assert.equal(calls.config.credentials, "fal-test-key");
      assert.equal(calls.subscribe.modelId, "fal-ai/nano-banana-pro");
      assert.equal(calls.subscribe.args.input.prompt, "a tiny red dot");

      const generatedFile = result.files[0];
      const saved = await fs.readFile(generatedFile);
      assert.ok(saved.length > 0);
      assert.equal(path.extname(generatedFile), ".png");
    } finally {
      restoreEnv("FAL_AI_API_KEY", previous);
    }
  });

  it("uses image-edit model when input_files are provided and numbers multi-output files", async () => {
    const previous = process.env.FAL_AI_API_KEY;
    process.env.FAL_AI_API_KEY = "fal-test-key";

    const sourceImagePath = path.join(tempDir, "source.png");
    await fs.writeFile(sourceImagePath, Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"));

    let capturedCall = null;
    const tool = createToolGenerateImage({
      baseDir: tempDir,
      falClient: {
        config() {},
        async subscribe(modelId, args) {
          capturedCall = { modelId, args };
          const dataUrl = `data:image/png;base64,${ONE_PIXEL_PNG_BASE64}`;
          return {
            data: {
              images: [{ url: dataUrl }, { url: dataUrl }],
            },
          };
        },
      },
    });

    try {
      const result = await tool.handler({
        prompt: "make two variants",
        input_files: [sourceImagePath],
        output_path: "outputs/generated.png",
        num_images: 2,
      });

      assert.equal(result.status, "completed");
      assert.equal(result.files.length, 2);
      assert.equal(capturedCall.modelId, "fal-ai/nano-banana-pro/edit");
      assert.equal(Array.isArray(capturedCall.args.input.image_urls), true);
      assert.equal(capturedCall.args.input.image_urls.length, 1);
      assert.ok(capturedCall.args.input.image_urls[0].startsWith("data:image/png;base64,"));

      assert.equal(path.basename(result.files[0]), "generated-1.png");
      assert.equal(path.basename(result.files[1]), "generated-2.png");
    } finally {
      restoreEnv("FAL_AI_API_KEY", previous);
    }
  });
});

function restoreEnv(name, value) {
  if (typeof value === "string") {
    process.env[name] = value;
    return;
  }
  delete process.env[name];
}
