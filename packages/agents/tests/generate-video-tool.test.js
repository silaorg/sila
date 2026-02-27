import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createToolGenerateVideo } from "../src/tools/generate-video-tool.js";

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

describe("generateVideoTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sila-agents-generate-video-"));
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
      const tool = createToolGenerateVideo({ baseDir: tempDir });
      const result = await tool.handler({
        prompt: "animate this",
        input_file: "input.png",
      });

      assert.equal(result.status, "failed");
      assert.match(result.message, /FAL_AI_API_KEY/i);
    } finally {
      restoreEnv("FAL_AI_API_KEY", previous);
    }
  });

  it("uploads input image, calls Fal image-to-video model, and saves output video", async () => {
    const previous = process.env.FAL_AI_API_KEY;
    process.env.FAL_AI_API_KEY = "fal-test-key";

    const inputPath = path.join(tempDir, "input.png");
    await fs.writeFile(inputPath, Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"));

    const calls = {
      config: null,
      uploadBlobType: "",
      subscribe: null,
    };

    const tool = createToolGenerateVideo({
      baseDir: tempDir,
      falClient: {
        config(args) {
          calls.config = args;
        },
        storage: {
          async upload(blob) {
            calls.uploadBlobType = blob?.type || "";
            return "https://example.test/uploaded-image.png";
          },
        },
        async subscribe(modelId, args) {
          calls.subscribe = { modelId, args };
          return {
            data: {
              video: { url: "https://example.test/generated-video.mp4" },
            },
          };
        },
      },
      fetchImpl: async (url) => {
        assert.equal(url, "https://example.test/generated-video.mp4");
        return createMockBinaryResponse(Buffer.from("mock-video"), "video/mp4");
      },
    });

    try {
      const result = await tool.handler({
        prompt: "camera slowly pans left",
        input_file: inputPath,
        duration: 5,
        aspect_ratio: "16:9",
        resolution: "1080p",
        generate_audio: true,
      });

      assert.equal(result.status, "completed");
      assert.equal(result.files.length, 1);
      assert.equal(calls.config.credentials, "fal-test-key");
      assert.equal(calls.uploadBlobType, "image/png");
      assert.equal(calls.subscribe.modelId, "fal-ai/veo3/image-to-video");
      assert.equal(calls.subscribe.args.input.prompt, "camera slowly pans left");
      assert.equal(calls.subscribe.args.input.image_url, "https://example.test/uploaded-image.png");
      assert.equal(calls.subscribe.args.input.duration, "6s");
      assert.equal(calls.subscribe.args.input.aspect_ratio, "16:9");
      assert.equal(calls.subscribe.args.input.resolution, "1080p");
      assert.equal(calls.subscribe.args.input.generate_audio, true);

      const videoPath = result.files[0];
      const output = await fs.readFile(videoPath, "utf8");
      assert.equal(output, "mock-video");
      assert.equal(path.extname(videoPath), ".mp4");
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
