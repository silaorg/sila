import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Space,
  FileSystemPersistenceLayer,
  ChatAppData,
  AppTree,
} from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { getToolGenerateVideo } from "../../../src/agents/tools/toolGenerateVideo";
import { getToolLs } from "../../../src/agents/tools/toolLs";
import { resolvePath } from "../../../src/agents/tools/fileUtils";

const testInputDir = path.join(__dirname, "test-input");

// Helper function to convert image file to data URL
async function imageFileToDataUrl(filePath: string): Promise<string> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Image file not found: ${filePath}`);
  }

  const imageBuffer = await readFile(filePath);
  const base64 = imageBuffer.toString("base64");
  
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  const mimeType = mimeTypes[ext] || "image/jpeg";

  return `data:${mimeType};base64,${base64}`;
}

// Get API key from environment (loaded from .env by setup-worker.ts)
const FAL_AI_API_KEY = process.env.FAL_AI_API_KEY;

describe("generate_video tool", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-generate-video-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("generates a video from test-input image and returns file path", async () => {
    // Skip test if API key is not configured
    if (!FAL_AI_API_KEY) {
      console.log("Skipping test: FAL_AI_API_KEY not set. Set FAL_AI_API_KEY in packages/core/tests/.env to run this test.");
      return;
    }

    // Check if input image exists, skip test if it doesn't
    const image1Path = path.join(testInputDir, "1.jpg");
    
    try {
      await access(image1Path);
    } catch {
      console.log("Skipping test: 1.jpg not found in test-input folder. Add image to run this test.");
      return;
    }

    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    // Set API key in space secrets
    if (FAL_AI_API_KEY) {
      space.setApiKey("falai", FAL_AI_API_KEY);
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    // Convert local image to data URL and add as attachment
    const image1DataUrl = await imageFileToDataUrl(image1Path);
    const image1Buffer = await readFile(image1Path);

    // Add image as attachment
    await chatData.newMessage({
      role: "user",
      text: "Adding test image",
      attachments: [
        {
          id: "img1",
          kind: "image",
          name: "1.jpg",
          mimeType: "image/jpeg",
          size: image1Buffer.length,
          dataUrl: image1DataUrl,
        },
      ],
    });

    // Verify the image file exists
    const lsTool = getToolLs(space, chatTree);
    const entries = await lsTool.handler({ uri: "file:" });
    const names = (entries as any[]).map((e) => e.name);
    expect(names).toContain("1.jpg");

    // Get the generate_video tool and call it
    const generateVideoTool = getToolGenerateVideo(space, chatTree);
    
    // Find the test image file path
    const image1Entry = (entries as any[]).find((e) => e.name === "1.jpg");
    expect(image1Entry).toBeDefined();
    
    // Resolve to full file path
    const inputFilePath = `file:${image1Entry.path}`;

    // Generate video from image
    const result = await generateVideoTool.handler({
      prompt: "animate the image with natural motion",
      input_file: inputFilePath,
      duration: 3,
      fps: 24,
      motion_intensity: 120,
    });

    // Debug: log the result if it failed
    if (result.status === "failed") {
      console.log("Video generation failed:", result.message);
    }

    // Verify the result
    expect(result.status).toBe("completed");
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1);

    const outputPath = result.files![0];
    expect(outputPath).toMatch(/^file:/);

    // Verify the generated video file exists and can be read
    const resolved = resolvePath(space, chatTree, outputPath);
    expect(resolved.vertex).toBeDefined();
    
    // Verify it's a video file
    const mimeType = resolved.vertex?.getProperty("mimeType") as string | undefined;
    expect(mimeType).toMatch(/^video\//);
    expect(resolved.vertex?.name).toBeDefined();
  });
});

