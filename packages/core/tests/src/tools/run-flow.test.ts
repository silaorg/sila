import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Space, FileSystemPersistenceLayer, ChatAppData } from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { getToolRunFlow, getToolTestFlow, inspectFlow, runFlowWithServices, TEST_SERVICE_DESCRIPTORS } from "../../../src/agents/tools/toolRunFlow";
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

    it("runs flow with simulated services via test_flow and captures outputs", async () => {
      const fs = new NodeFileSystem();
      const space = Space.newSpace(crypto.randomUUID());
      const spaceId = space.getId();

      const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
      if (typeof (layer as any).getFileStoreProvider === "function") {
        space.setFileStoreProvider((layer as any).getFileStoreProvider());
      }

      const chatTree = ChatAppData.createNewChatTree(space, "test-config");
      const chatData = new ChatAppData(space, chatTree);

      const code = `function setup(flow) {
  flow.title("Test image flow");
  flow.inImg("img-a", "Input image");
  flow.outImgs("result", "Output");
}

async function run(services) {
  const source = services.inputs["img-a"];
  const generated = await services.img([source], "Pretend to generate an image");
  services.outputs("result", generated);
  return generated;
}`;

      await chatData.newMessage({
        role: "user",
        text: "Creating test flow with outputs",
        attachments: [
          {
            id: "flow5",
            kind: "text",
            name: "test-output.flow.js",
            mimeType: "application/javascript",
            size: code.length,
            content: code,
          },
        ],
      });

      const testFlowTool = getToolTestFlow(space, chatTree);
      const result = await testFlowTool.handler({
        path: "file:test-output.flow.js",
        inputs: { "img-a": { kind: "file", fileId: "input-img" } },
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.kind).toBe("file");
      expect(result.outputs).toBeDefined();
      expect(result.outputs?.result).toBeDefined();
      expect(result.outputs?.result.meta?.simulated).toBe(true);
    });

    it("collects services.outputs when runFlowWithServices uses simulated descriptors", async () => {
      const fs = new NodeFileSystem();
      const space = Space.newSpace(crypto.randomUUID());
      const spaceId = space.getId();

      const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
      if (typeof (layer as any).getFileStoreProvider === "function") {
        space.setFileStoreProvider((layer as any).getFileStoreProvider());
      }

      const chatTree = ChatAppData.createNewChatTree(space, "test-config");
      const chatData = new ChatAppData(space, chatTree);

      const code = `function setup(flow) {
  flow.title("Test outputs");
  flow.inImg("img", "Input");
  flow.outImgs("mock", "Mock Output");
}

async function run(services) {
  const img = services.inputs["img"];
  const generated = await services.img([img], "Generate mock");
  services.outputs("mock", generated);
  return generated;
}`;

      await chatData.newMessage({
        role: "user",
        text: "Creating flow for outputs",
        attachments: [
          {
            id: "flow6",
            kind: "text",
            name: "outputs.flow.js",
            mimeType: "application/javascript",
            size: code.length,
            content: code,
          },
        ],
      });

      const fileCode = await resolveWorkspaceFileUrl("file:outputs.flow.js", space, chatTree);
      const runResult = await runFlowWithServices(fileCode, TEST_SERVICE_DESCRIPTORS, space, chatTree, {
        img: { kind: "file", fileId: "input" },
      });

      expect(runResult.success).toBe(true);
      expect(runResult.outputs).toBeDefined();
      expect(runResult.outputs?.mock).toBeDefined();
      expect(runResult.outputs?.mock.meta?.prompt).toBe("Generate mock");
    });
});

