import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileSystemPersistenceLayer, Space, ChatAppData, AgentServices } from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { toolWriteToFile } from "../../../src/agents/tools/toolWriteToFile";
import { toolSearchReplacePatch } from "../../../src/agents/tools/toolSearchReplacePatch";

const decoder = new TextDecoder();

describe("apply_search_replace_patch tool", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-search-replace-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("applies SEARCH/REPLACE patches to an existing workspace file", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const services = new AgentServices(space);
    const writeTool = toolWriteToFile.getTool(services, chatTree);
    const patchTool = toolSearchReplacePatch.getTool(services, chatTree);

    await writeTool.handler({
      path: "file:///assets/example.txt",
      content: "line1\nline2\nline3\n",
    });

    const patch = `file:///assets/example.txt
<<<<<<< SEARCH
line2
=======
updated line2
>>>>>>> REPLACE`;

    const result = await patchTool.handler({
      patch,
    });

    expect(result.status).toBe("completed");

    const vertex = space.fileResolver.pathToVertex("file:///assets/example.txt");
    const id = (vertex.getProperty("id") as string | undefined) ?? "";
    const bytes = await space.fileStore!.getMutable(id);
    const text = decoder.decode(bytes);

    expect(text).toContain("updated line2");
    expect(text).toContain("line1\n");
  });

  it("creates a new file when missing by default", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const services = new AgentServices(space);
    const patchTool = toolSearchReplacePatch.getTool(services, chatTree);

    const patch = `file:///assets/newfile.md
<<<<<<< SEARCH
=======
brand new content
>>>>>>> REPLACE`;

    const result = await patchTool.handler({
      patch,
    });

    expect(result.status).toBe("completed");

    const vertex = space.fileResolver.pathToVertex("file:///assets/newfile.md");
    const id = (vertex.getProperty("id") as string | undefined) ?? "";
    const bytes = await space.fileStore!.getMutable(id);
    const text = decoder.decode(bytes);

    expect(text).toContain("brand new content");
  });
});
