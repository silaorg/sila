import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Space, FileSystemPersistenceLayer, ChatAppData } from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { getToolRunFlow } from "../../../src/agents/tools/toolRunFlow";

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
});

