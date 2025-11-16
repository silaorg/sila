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
import { getToolLs } from "../../../src/agents/tools/toolLs";

describe("ls tool for workspace/chat files", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-ls-workspace-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("lists chat files with file: URI", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    // Provide FileStore for CAS writes
    const fileStore = createFileStore((layer as any).getFileStoreProvider?.());
    if (!fileStore) {
      throw new Error("FileStore not available");
    }
    space.setFileStoreProvider((layer as any).getFileStoreProvider());

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    const content = "hello from ls";
    await chatData.newMessage({
      role: "user",
      text: "Attaching a doc for ls",
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

    const lsTool = getToolLs(space, chatTree);
    const entries = await lsTool.handler({ uri: "file:" });

    const names = (entries as any[]).map((e) => e.name);
    expect(names).toContain("document.md");
  });

  it("lists workspace assets with file:///assets URI", async () => {
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

    // Workspace assets live under the space root 'assets' vertex
    const assetsRoot = space.getVertexByPath("assets");
    if (!assetsRoot) {
      throw new Error("Space assets root not found");
    }

    const bytes = new TextEncoder().encode("brand text");
    const put = await fileStore.putBytes(bytes, "text/markdown");
    assetsRoot.newNamedChild("brand.md", {
      name: "brand.md",
      hash: put.hash,
      mimeType: "text/markdown",
      size: bytes.byteLength,
    });

    const lsTool = getToolLs(space);
    const entries = await lsTool.handler({ uri: "file:///assets" });
    const names = (entries as any[]).map((e) => e.name);
    expect(names).toContain("brand.md");
  });
});


