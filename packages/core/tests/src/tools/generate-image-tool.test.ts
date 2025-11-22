import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Space,
  FileSystemPersistenceLayer,
  ChatAppData,
  createFileStore,
  FilesTreeData,
} from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { getToolGenerateImage } from "../../../src/agents/tools/toolGenerateImage";
import { getToolLs } from "../../../src/agents/tools/toolLs";
import { FileResolver } from "../../../src/spaces/files/FileResolver";
import { ChatAppData } from "@sila/core";

const testInputDir = path.join(__dirname, "test-input");

// Get API key from environment (loaded from .env by setup-worker.ts)
const FAL_AI_API_KEY = process.env.FAL_AI_API_KEY;

// Helper function to convert image file to data URL
async function imageFileToDataUrl(filePath: string): Promise<string> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Image file not found: ${filePath}`);
  }

  const imageBuffer = await readFile(filePath);
  const base64 = imageBuffer.toString("base64");
  
  // Determine MIME type from file extension
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

describe("generate_image tool", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-generate-image-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("combines two images from test-input folder and returns file path", async () => {
    // Skip test if API key is not configured
    if (!FAL_AI_API_KEY) {
      console.log("Skipping test: FAL_AI_API_KEY not set. Set FAL_AI_API_KEY in packages/core/tests/.env to run this test.");
      return;
    }

    // Check if input images exist, skip test if they don't
    const image1Path = path.join(testInputDir, "1.jpg");
    const image2Path = path.join(testInputDir, "2.jpg");
    
    try {
      await access(image1Path);
      await access(image2Path);
    } catch {
      console.log("Skipping test: 1.jpg or 2.jpg not found in test-input folder. Add images to run this test.");
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

    // Convert local images to data URLs and add them as attachments
    const image1DataUrl = await imageFileToDataUrl(image1Path);
    const image2DataUrl = await imageFileToDataUrl(image2Path);

    // Get file sizes
    const image1Buffer = await readFile(image1Path);
    const image2Buffer = await readFile(image2Path);

    // Add both images as attachments
    await chatData.newMessage({
      role: "user",
      text: "Adding test images",
      attachments: [
        {
          id: "img1",
          kind: "image",
          name: "1.jpg",
          mimeType: "image/jpeg",
          size: image1Buffer.length,
          dataUrl: image1DataUrl,
        },
        {
          id: "img2",
          kind: "image",
          name: "2.jpg",
          mimeType: "image/jpeg",
          size: image2Buffer.length,
          dataUrl: image2DataUrl,
        },
      ],
    });

    // Verify the image files exist
    const lsTool = getToolLs(space, chatTree);
    const entries = await lsTool.handler({ uri: "file:" });
    const names = (entries as any[]).map((e) => e.name);
    expect(names).toContain("1.jpg");
    expect(names).toContain("2.jpg");

    // Get the generate_image tool and call it
    const generateImageTool = getToolGenerateImage(space, chatTree);
    
    // Find the test image file paths
    const image1Entry = (entries as any[]).find((e) => e.name === "1.jpg");
    const image2Entry = (entries as any[]).find((e) => e.name === "2.jpg");
    expect(image1Entry).toBeDefined();
    expect(image2Entry).toBeDefined();
    
    // Resolve to full file paths
    const inputFilePath1 = `file:${image1Entry.path}`;
    const inputFilePath2 = `file:${image2Entry.path}`;

    // Generate image combining both inputs
    const result = await generateImageTool.handler({
      prompt: "combine these two images into one cohesive scene",
      input_files: [inputFilePath1, inputFilePath2],
      num_images: 1,
    });

    // Verify the result
    expect(result.status).toBe("completed");
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBeGreaterThan(0);

    const outputPath = result.files![0];
    expect(outputPath).toMatch(/^file:/);

    // Verify the generated image file exists and can be read
    const resolver = new FileResolver(space);
    const isWorkspacePath = outputPath.startsWith("file:///");
    const relativeRootVertex = isWorkspacePath 
      ? undefined 
      : chatTree.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
    const fileVertex = resolver.pathToVertex(outputPath, relativeRootVertex);
    expect(fileVertex).toBeDefined();
    
    // Verify it's an image file
    const mimeType = fileVertex.getProperty("mimeType") as string | undefined;
    expect(mimeType).toMatch(/^image\//);
    expect(fileVertex.name).toBeDefined();
  });

  it("generates image with custom output path using test-input image", async () => {
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

    await chatData.newMessage({
      role: "user",
      text: "Adding test image",
      attachments: [
        {
          id: "img1",
          kind: "image",
          name: "input.jpg",
          mimeType: "image/jpeg",
          size: image1Buffer.length,
          dataUrl: image1DataUrl,
        },
      ],
    });

    const lsTool = getToolLs(space, chatTree);
    const entries = await lsTool.handler({ uri: "file:" });
    const imageEntry = (entries as any[]).find((e) => e.name === "input.jpg");
    const inputFilePath = `file:${imageEntry.path}`;

    const generateImageTool = getToolGenerateImage(space, chatTree);

    // Generate with custom output path
    const customOutputPath = "file:generated-output.png";
    const result = await generateImageTool.handler({
      prompt: "add a blue sky background",
      input_files: [inputFilePath],
      output_path: customOutputPath,
      num_images: 1,
    });

    expect(result.status).toBe("completed");
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1);
    
    // The output should match our custom path (or be close to it)
    const outputPath = result.files![0];
    expect(outputPath).toContain("generated-output");
  });

  it("fails gracefully when input file doesn't exist", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");

    const generateImageTool = getToolGenerateImage(space, chatTree);

    // Try to generate with non-existent file
    const result = await generateImageTool.handler({
      prompt: "edit this image",
      input_files: ["file:nonexistent.png"],
      num_images: 1,
    });

      expect(result.status).toBe("failed");
      expect(result.message).toContain("Fal.ai API key not configured");
  });

  it("fails when API key is not configured", async () => {
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

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    // Convert local image to data URL and add as attachment
    const image1DataUrl = await imageFileToDataUrl(image1Path);
    const image1Buffer = await readFile(image1Path);

    await chatData.newMessage({
      role: "user",
      text: "Adding test image",
      attachments: [
        {
          id: "img1",
          kind: "image",
          name: "test.jpg",
          mimeType: "image/jpeg",
          size: image1Buffer.length,
          dataUrl: image1DataUrl,
        },
      ],
    });

    const lsTool = getToolLs(space, chatTree);
    const entries = await lsTool.handler({ uri: "file:" });
    const imageEntry = (entries as any[]).find((e) => e.name === "test.jpg");
    
    // Test that the tool fails when API key is not configured in space secrets
    // Don't set API key - space is new, so no secrets should be configured
    const generateImageTool = getToolGenerateImage(space, chatTree);
    
    const result = await generateImageTool.handler({
      prompt: "edit image",
      input_files: [`file:${imageEntry.path}`],
      num_images: 1,
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain("Fal.ai API key not configured");
  });

  it("generates a new image without input files", async () => {
    // Skip test if API key is not configured
    if (!FAL_AI_API_KEY) {
      console.log("Skipping test: FAL_AI_API_KEY not set. Set FAL_AI_API_KEY in packages/core/tests/.env to run this test.");
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

    // Get the generate_image tool and call it without input_files
    const generateImageTool = getToolGenerateImage(space, chatTree);
    
    // Generate image without any input files
    const result = await generateImageTool.handler({
      prompt: "a beautiful sunset over mountains",
      num_images: 1,
    });

    // Verify the result
    expect(result.status).toBe("completed");
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBeGreaterThan(0);

    const outputPath = result.files![0];
    expect(outputPath).toMatch(/^file:/);

    // Verify the generated image file exists and can be read
    const resolver = new FileResolver(space);
    const isWorkspacePath = outputPath.startsWith("file:///");
    const relativeRootVertex = isWorkspacePath 
      ? undefined 
      : chatTree.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
    const fileVertex = resolver.pathToVertex(outputPath, relativeRootVertex);
    expect(fileVertex).toBeDefined();
    
    // Verify it's an image file
    const mimeType = fileVertex.getProperty("mimeType") as string | undefined;
    expect(mimeType).toMatch(/^image\//);
    expect(fileVertex.name).toBeDefined();
  });
});

