import { describe, it, expect } from "vitest";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ImgGen } from "../../../src/tools/falai";

describe("Fal.ai image generation", () => {
  const testOutputDir = path.join(__dirname, "test-output");
  const apiKey = "<insert your API key here>"; // Replace with actual API key

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
});

