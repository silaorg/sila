import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Space,
  FileSystemPersistenceLayer,
  ChatAppData,
  createFileStore,
  AgentServices,
} from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { toolMkdir } from "../../../src/agents/tools/toolMkdir";
import { toolRm } from "../../../src/agents/tools/toolRm";
import { toolLs } from "../../../src/agents/tools/toolLs";

describe("mkdir and rm tools for workspace/chat files", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-mkdir-rm-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("creates and deletes chat folders with file: URIs", async () => {
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
    void chatData; // currently unused, but future tests may use it
    const services = new AgentServices(space);

    const mkdirTool = toolMkdir.getTool(services, chatTree);
    const rmTool = toolRm.getTool(services, chatTree);
    const lsTool = toolLs.getTool(services, chatTree);

    await mkdirTool.handler({ uri: "file:notes/projects" });
    const afterMkdir = await lsTool.handler({ uri: "file:" });
    const chatNames = (afterMkdir as any[]).map((e) => e.name);
    expect(chatNames).toContain("notes");

    await rmTool.handler({ uri: "file:notes" });
    const afterRm = await lsTool.handler({ uri: "file:" });
    const chatNamesAfterRm = (afterRm as any[]).map((e) => e.name);
    expect(chatNamesAfterRm).not.toContain("notes");
  });

  it("creates and deletes workspace asset folders with file:///assets URIs", async () => {
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

    const mkdirTool = toolMkdir.getTool(services, chatTree);
    const rmTool = toolRm.getTool(services, chatTree);
    const lsTool = toolLs.getTool(services, chatTree);

    // Create a folder under workspace assets
    await mkdirTool.handler({ uri: "file:///assets/docs" });
    const afterMkdir = await lsTool.handler({ uri: "file:///assets" });
    const assetNames = (afterMkdir as any[]).map((e) => e.name);
    expect(assetNames).toContain("docs");

    // Delete it
    await rmTool.handler({ uri: "file:///assets/docs" });
    const afterRm = await lsTool.handler({ uri: "file:///assets" });
    const assetNamesAfterRm = (afterRm as any[]).map((e) => e.name);
    expect(assetNamesAfterRm).not.toContain("docs");
  });
});


