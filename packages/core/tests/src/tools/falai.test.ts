import { describe, it, expect } from "vitest";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";
import { ImgGen } from "../../../src/tools/falai";

describe("Fal.ai image generation", () => {
  const testOutputDir = path.join(__dirname, "test-output");
  const testInputDir = path.join(__dirname, "test-input");
  const apiKey = "<insert your API key here>"; // Replace with actual API key

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

  /*
  it("generates an image and saves it to test-output folder", async () => {
    // Create test-output directory if it doesn't exist
    await mkdir(testOutputDir, { recursive: true });

    const imgGen = new ImgGen(apiKey);

    // Use a simple test image URL for editing
    // You can use any publicly accessible image URL for testing
    const testImageUrl = "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png";

    let progressUpdates: string[] = [];

    const result = await imgGen.generateFull({
      prompt: "change the setting to the middle age city",
      image: testImageUrl,
      num_images: 1,
      onProgress: (progress) => {
        progressUpdates.push(`${progress.status}: ${progress.message || ""}`);
        console.log(`Progress: ${progress.status} - ${progress.message || ""}`);
      },
    });

    expect(result.urls).toBeDefined();
    expect(result.urls.length).toBeGreaterThan(0);

    // Download and save the first generated image
    const imageUrl = result.urls[0];
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const imageData = new Uint8Array(imageBuffer);

    // Determine file extension from URL or use .png as default
    const urlPath = new URL(imageUrl).pathname;
    const extension = urlPath.match(/\.(png|jpeg|jpg|webp)$/i)?.[1] || "png";
    const outputPath = path.join(testOutputDir, `generated-image-${Date.now()}.${extension}`);

    await writeFile(outputPath, imageData);

    console.log(`Image saved to: ${outputPath}`);
    console.log(`Progress updates received: ${progressUpdates.length}`);
    expect(imageData.length).toBeGreaterThan(0);
  });
  */

  it("combines two images from test-input folder", async () => {
    // Create test-output directory if it doesn't exist
    await mkdir(testOutputDir, { recursive: true });

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

    const imgGen = new ImgGen(apiKey);

    // Convert local images to data URLs
    const image1DataUrl = await imageFileToDataUrl(image1Path);
    const image2DataUrl = await imageFileToDataUrl(image2Path);

    let progressUpdates: string[] = [];

    const result = await imgGen.generateFull({
      prompt: "combine these two images into one cohesive scene",
      image: [image1DataUrl, image2DataUrl],
      num_images: 1,
      onProgress: (progress) => {
        progressUpdates.push(`${progress.status}: ${progress.message || ""}`);
        console.log(`Progress: ${progress.status} - ${progress.message || ""}`);
      },
    });

    expect(result.urls).toBeDefined();
    expect(result.urls.length).toBeGreaterThan(0);

    // Download and save the generated combined image
    const imageUrl = result.urls[0];
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const imageData = new Uint8Array(imageBuffer);

    // Determine file extension from URL or use .png as default
    const urlPath = new URL(imageUrl).pathname;
    const extension = urlPath.match(/\.(png|jpeg|jpg|webp)$/i)?.[1] || "png";
    const outputPath = path.join(testOutputDir, `combined-image-${Date.now()}.${extension}`);

    await writeFile(outputPath, imageData);

    console.log(`Combined image saved to: ${outputPath}`);
    console.log(`Progress updates received: ${progressUpdates.length}`);
    expect(imageData.length).toBeGreaterThan(0);
  });
});

