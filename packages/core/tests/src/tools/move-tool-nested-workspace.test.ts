import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Space,
  FileSystemPersistenceLayer,
  ChatAppData,
  FilesTreeData,
  createFileStore,
} from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { getToolMove } from "../../../src/agents/tools/toolMove";
import { getToolLs } from "../../../src/agents/tools/toolLs";

describe("move tool nested workspace paths", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-move-tool-nested-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("moves a chat file into a nested workspace path and auto-creates folders", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    const fileStore = createFileStore((layer as any).getFileStoreProvider?.());
    if (!fileStore) {
      throw new Error("FileStore not available");
    }
    space.setFileStoreProvider((layer as any).getFileStoreProvider());

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    // Create a file in chat under assets/flow
    const content = "flow doc content";
    await chatData.newMessage({
      role: "user",
      text: "Attaching a flow doc",
      attachments: [
        {
          id: "att1",
          kind: "text",
          name: "2022-05_flow.md",
          mimeType: "text/markdown",
          size: content.length,
          content,
        },
      ],
      fileTarget: { treeId: chatTree.getId(), path: `${ChatAppData.ASSETS_ROOT_PATH}/flow` },
    });

    const moveTool = getToolMove(space, chatTree);
    const lsWorkspaceTool = getToolLs(space);

    // Move from chat assets to nested workspace assets path
    await moveTool.handler({
      source: "file:assets/flow/2022-05_flow.md",
      destination: "file:///assets/flow/2022-05_flow.md",
    });

    // Verify file exists at nested workspace path
    const entries = await lsWorkspaceTool.handler({ uri: "file:///assets/flow" });
    const names = (entries as any[]).map((e) => e.name);
    expect(names).toContain("2022-05_flow.md");
  });
});


