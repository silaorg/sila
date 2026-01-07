import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Space, FileSystemPersistenceLayer, ChatAppData, AgentServices } from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { toolRead } from "../../../src/agents/tools/toolRead";

describe("read tool with workspace-aware file: URIs", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-read-workspace-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reads a text attachment from chat files via file:document.md", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    // Connect CAS to the space
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);
    const services = new AgentServices(space);

    const content = "# Hello\nThis is a workspace text file.";

    // Create a user message with a text attachment; this will persist into CAS and chat 'files'
    await chatData.newMessage({
      role: "user",
      text: "Attaching a doc",
      attachments: [
        {
          id: "att1",
          kind: "text",
          name: "document.md",
          mimeType: "text/markdown",
          size: content.length,
          content
        }
      ]
    });

    const readTool = toolRead.getTool(services, chatTree);

    const result = await readTool.handler({ uri: "file:document.md" });

    expect(result.content).toContain("# Hello");
    expect(result.content).toContain("This is a workspace text file.");
  });
});


