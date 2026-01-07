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
  AgentServices,
} from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { toolMove } from "../../../src/agents/tools/toolMove";
import { toolLs } from "../../../src/agents/tools/toolLs";
import { toolMkdir } from "../../../src/agents/tools/toolMkdir";

describe("move tool for workspace/chat files", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-move-tool-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("moves a file within chat files (file: to file:)", async () => {
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
    const services = new AgentServices(space);

    // Create a file in chat
    const content = "test content";
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
          content,
        },
      ],
    });

    // Create a folder
    const mkdirTool = toolMkdir.getTool(services, chatTree);
    await mkdirTool.handler({ uri: "file:archive" });

    // Move the file into the folder
    const moveTool = toolMove.getTool(services, chatTree);
    const lsTool = toolLs.getTool(services, chatTree);

    await moveTool.handler({
      source: "file:document.md",
      destination: "file:archive",
    });

    // Verify file is in archive folder
    const archiveEntries = await lsTool.handler({ uri: "file:archive" });
    const archiveNames = (archiveEntries as any[]).map((e) => e.name);
    expect(archiveNames).toContain("document.md");

    // Verify file is not in root
    const rootEntries = await lsTool.handler({ uri: "file:" });
    const rootNames = (rootEntries as any[]).map((e) => e.name);
    expect(rootNames).not.toContain("document.md");
  });

  it("moves a file within workspace assets (file:/// to file:///)", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    let fileStore = null as ReturnType<typeof createFileStore> | null;
    if (typeof (layer as any).getFileStoreProvider === "function") {
      const provider = (layer as any).getFileStoreProvider();
      space.setFileStoreProvider(provider);
      fileStore = createFileStore(provider);
    }
    if (!fileStore) {
      throw new Error("FileStore not available");
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const services = new AgentServices(space);

    // Create a file in workspace assets
    const assetsRoot = space.getVertexByPath("assets");
    if (!assetsRoot) {
      throw new Error("Space assets root not found");
    }

    const bytes = new TextEncoder().encode("workspace file content");
    const put = await fileStore.putBytes(bytes, "text/markdown");
    assetsRoot.newNamedChild("workspace-file.md", {
      name: "workspace-file.md",
      hash: put.hash,
      mimeType: "text/markdown",
      size: bytes.byteLength,
    });

    // Create a folder
    const mkdirTool = toolMkdir.getTool(services, chatTree);
    await mkdirTool.handler({ uri: "file:///assets/docs" });

    // Move the file into the folder
    const moveTool = toolMove.getTool(services, chatTree);
    const lsTool = toolLs.getTool(services, chatTree);

    await moveTool.handler({
      source: "file:///assets/workspace-file.md",
      destination: "file:///assets/docs",
    });

    // Verify file is in docs folder
    const docsEntries = await lsTool.handler({ uri: "file:///assets/docs" });
    const docsNames = (docsEntries as any[]).map((e) => e.name);
    expect(docsNames).toContain("workspace-file.md");

    // Verify file is not in assets root
    const assetsEntries = await lsTool.handler({ uri: "file:///assets" });
    const assetsNames = (assetsEntries as any[]).map((e) => e.name);
    expect(assetsNames).not.toContain("workspace-file.md");
  });

  it("moves a file from chat to workspace (file: to file:///)", async () => {
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
    const services = new AgentServices(space);

    // Create a file in chat
    const content = "chat file content";
    await chatData.newMessage({
      role: "user",
      text: "Attaching a doc",
      attachments: [
        {
          id: "att1",
          kind: "text",
          name: "chat-doc.md",
          mimeType: "text/markdown",
          size: content.length,
          content,
        },
      ],
    });

    const moveTool = toolMove.getTool(services, chatTree);
    const lsTool = toolLs.getTool(services, chatTree);
    const lsWorkspaceTool = toolLs.getTool(services, chatTree);

    // Move from chat to workspace
    await moveTool.handler({
      source: "file:chat-doc.md",
      destination: "file:///assets",
    });

    // Verify file is in workspace assets
    const assetsEntries = await lsWorkspaceTool.handler({ uri: "file:///assets" });
    const assetsNames = (assetsEntries as any[]).map((e) => e.name);
    expect(assetsNames).toContain("chat-doc.md");

    // Verify file is not in chat
    const chatEntries = await lsTool.handler({ uri: "file:" });
    const chatNames = (chatEntries as any[]).map((e) => e.name);
    expect(chatNames).not.toContain("chat-doc.md");
  });

  it("moves a file from workspace to chat (file:/// to file:)", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    let fileStore = null as ReturnType<typeof createFileStore> | null;
    if (typeof (layer as any).getFileStoreProvider === "function") {
      const provider = (layer as any).getFileStoreProvider();
      space.setFileStoreProvider(provider);
      fileStore = createFileStore(provider);
    }
    if (!fileStore) {
      throw new Error("FileStore not available");
    }

    // Create a file in workspace assets
    const assetsRoot = space.getVertexByPath("assets");
    if (!assetsRoot) {
      throw new Error("Space assets root not found");
    }

    const bytes = new TextEncoder().encode("workspace content");
    const put = await fileStore.putBytes(bytes, "text/markdown");
    assetsRoot.newNamedChild("workspace-doc.md", {
      name: "workspace-doc.md",
      hash: put.hash,
      mimeType: "text/markdown",
      size: bytes.byteLength,
    });

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);
    void chatData; // unused but needed for setup
    const services = new AgentServices(space);

    const moveTool = toolMove.getTool(services, chatTree);
    const lsTool = toolLs.getTool(services, chatTree);
    const lsWorkspaceTool = toolLs.getTool(services, chatTree);

    // Move from workspace to chat
    await moveTool.handler({
      source: "file:///assets/workspace-doc.md",
      destination: "file:",
    });

    // Verify file is in chat
    const chatEntries = await lsTool.handler({ uri: "file:" });
    const chatNames = (chatEntries as any[]).map((e) => e.name);
    expect(chatNames).toContain("workspace-doc.md");

    // Verify file is not in workspace
    const assetsEntries = await lsWorkspaceTool.handler({ uri: "file:///assets" });
    const assetsNames = (assetsEntries as any[]).map((e) => e.name);
    expect(assetsNames).not.toContain("workspace-doc.md");
  });

  it("moves a folder with files recursively", async () => {
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
    const services = new AgentServices(space);

    // Create a folder with a file
    const mkdirTool = toolMkdir.getTool(services, chatTree);
    await mkdirTool.handler({ uri: "file:source" });

    const content = "nested file content";
    await chatData.newMessage({
      role: "user",
      text: "Attaching a doc",
      attachments: [
        {
          id: "att1",
          kind: "text",
          name: "nested.md",
          mimeType: "text/markdown",
          size: content.length,
          content,
        },
      ],
    });

    // Move the file into source folder first
    const moveTool = toolMove.getTool(services, chatTree);
    await moveTool.handler({
      source: "file:nested.md",
      destination: "file:source",
    });

    // Create destination folder
    await mkdirTool.handler({ uri: "file:destination" });

    // Move the entire source folder
    await moveTool.handler({
      source: "file:source",
      destination: "file:destination",
    });

    const lsTool = toolLs.getTool(services, chatTree);

    // Verify source folder is in destination
    const destEntries = await lsTool.handler({ uri: "file:destination" });
    const destNames = (destEntries as any[]).map((e) => e.name);
    expect(destNames).toContain("source");

    // Verify nested file is still in source folder
    const sourceEntries = await lsTool.handler({ uri: "file:destination/source" });
    const sourceNames = (sourceEntries as any[]).map((e) => e.name);
    expect(sourceNames).toContain("nested.md");

    // Verify source folder is not in root
    const rootEntries = await lsTool.handler({ uri: "file:" });
    const rootNames = (rootEntries as any[]).map((e) => e.name);
    expect(rootNames).not.toContain("source");
  });

  it("renames a file when moving to a new name", async () => {
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
    const services = new AgentServices(space);

    // Create a file
    const content = "original file";
    await chatData.newMessage({
      role: "user",
      text: "Attaching a doc",
      attachments: [
        {
          id: "att1",
          kind: "text",
          name: "original.md",
          mimeType: "text/markdown",
          size: content.length,
          content,
        },
      ],
    });

    const moveTool = toolMove.getTool(services, chatTree);
    const lsTool = toolLs.getTool(services, chatTree);

    // Move and rename
    await moveTool.handler({
      source: "file:original.md",
      destination: "file:renamed.md",
    });

    // Verify renamed file exists
    const entries = await lsTool.handler({ uri: "file:" });
    const names = (entries as any[]).map((e) => e.name);
    expect(names).toContain("renamed.md");
    expect(names).not.toContain("original.md");
  });

  it("throws error when trying to move non-existent source", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      const provider = (layer as any).getFileStoreProvider();
      space.setFileStoreProvider(provider);
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);
    void chatData;
    const services = new AgentServices(space);

    const moveTool = toolMove.getTool(services, chatTree);

    await expect(
      moveTool.handler({
        source: "file:nonexistent.md",
        destination: "file:destination",
      })
    ).rejects.toThrow("source not found");
  });

  it("throws error when trying to move into a file (not a folder)", async () => {
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
    const services = new AgentServices(space);

    // Create two files
    const content1 = "file 1";
    await chatData.newMessage({
      role: "user",
      text: "Attaching doc 1",
      attachments: [
        {
          id: "att1",
          kind: "text",
          name: "file1.md",
          mimeType: "text/markdown",
          size: content1.length,
          content: content1,
        },
      ],
    });

    const content2 = "file 2";
    await chatData.newMessage({
      role: "user",
      text: "Attaching doc 2",
      attachments: [
        {
          id: "att2",
          kind: "text",
          name: "file2.md",
          mimeType: "text/markdown",
          size: content2.length,
          content: content2,
        },
      ],
    });

    const moveTool = toolMove.getTool(services, chatTree);

    await expect(
      moveTool.handler({
        source: "file:file1.md",
        destination: "file:file2.md",
      })
    ).rejects.toThrow("is a file, not a folder");
  });
});

