import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Space, FileSystemPersistenceLayer, ChatAppData } from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { getToolRunFlow, inspectFlow, runFlowWithServices } from "../../../src/agents/tools/toolRunFlow";
import { resolveWorkspaceFileUrl } from "../../../src/agents/tools/workspaceProxyFetch";

describe("run_flow tool - basic JavaScript execution", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-run-flow-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("executes simple JavaScript code that returns a value", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    // Create a simple flow file
    const code = "1 + 1";
    await chatData.newMessage({
      role: "user",
      text: "Creating test flow",
      attachments: [
        {
          id: "flow1",
          kind: "text",
          name: "test.flow.js",
          mimeType: "application/javascript",
          size: code.length,
          content: code,
        },
      ],
    });

    const runFlowTool = getToolRunFlow(space, chatTree);
    const result = await runFlowTool.handler({ path: "file:test.flow.js" });

    expect(result.success).toBe(true);
    expect(result.result).toBe(2);
  });

  it("executes code with console.log and captures stdout", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    const code = 'console.log("Hello, World!");';
    await chatData.newMessage({
      role: "user",
      text: "Creating test flow",
      attachments: [
        {
          id: "flow2",
          kind: "text",
          name: "hello.flow.js",
          mimeType: "application/javascript",
          size: code.length,
          content: code,
        },
      ],
    });

    const runFlowTool = getToolRunFlow(space, chatTree);
    const result = await runFlowTool.handler({ path: "file:hello.flow.js" });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("Hello, World!");
  });

  it("handles execution errors gracefully", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    const code = "throw new Error('Test error');";
    await chatData.newMessage({
      role: "user",
      text: "Creating test flow",
      attachments: [
        {
          id: "flow3",
          kind: "text",
          name: "error.flow.js",
          mimeType: "application/javascript",
          size: code.length,
          content: code,
        },
      ],
    });

    const runFlowTool = getToolRunFlow(space, chatTree);
    const result = await runFlowTool.handler({ path: "file:error.flow.js" });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.stderr).toBeDefined();
  });

  it("inspects pipeline flow and then runs it with services", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    // Create a flow file with setup() and run() functions
    const code = `function setup(flow) {
  flow.title("Simple pipeline");
  flow.describe("A simple pipeline that processes an image");
  flow.inImg("img-a", "Input image");
}

async function run(services) {
  const imgA = services.inputs["img-a"];
  const result = await services.processImage(imgA, "Apply filter");
  return result;
}`;

    await chatData.newMessage({
      role: "user",
      text: "Creating pipeline flow",
      attachments: [
        {
          id: "flow4",
          kind: "text",
          name: "pipeline.flow.js",
          mimeType: "application/javascript",
          size: code.length,
          content: code,
        },
      ],
    });

    // Read the file content
    const fileCode = await resolveWorkspaceFileUrl("file:pipeline.flow.js", space, chatTree);

    // Phase 1: Inspect the flow
    const inspectResult = await inspectFlow(fileCode, space, chatTree);

    expect(inspectResult.success).toBe(true);
    expect(inspectResult.metadata).toBeDefined();
    expect(inspectResult.metadata?.description).toBe("Simple pipeline");
    expect(inspectResult.metadata?.inputs).toHaveLength(1);
    expect(inspectResult.metadata?.inputs?.[0]).toEqual({
      id: "img-a",
      type: "image",
      label: "Input image",
      optional: false,
    });

    // Phase 2: Run with services
    // Note: Can't pass functions through postMessage, so we'll use a descriptor
    // The worker will create mock services based on the descriptor
    const mockServices = {
      processImage: {
        type: "mock",
        returns: { processed: true, prompt: "Apply filter", imageId: "img-a" }
      }
    };

    // Pass inputs to the run function
    const inputs = {
      "img-a": "test-image-id"
    };
    
    const runResult = await runFlowWithServices(fileCode, mockServices, space, chatTree, inputs);

    if (!runResult.success) {
      console.error("Run failed - error:", runResult.error);
      console.error("Run failed - stderr:", runResult.stderr);
      console.error("Run failed - full result:", JSON.stringify(runResult, null, 2));
    }
    
    console.log("Full runResult:", JSON.stringify(runResult, null, 2));
    
    expect(runResult.success).toBe(true);
    expect(runResult.result).toBeDefined();
    console.log("Actual result:", JSON.stringify(runResult.result, null, 2));
    // The mock service returns the descriptor.returns value
    expect(runResult.result.processed).toBe(true);
    expect(runResult.result.imageId).toBe("img-a");
  });
});

