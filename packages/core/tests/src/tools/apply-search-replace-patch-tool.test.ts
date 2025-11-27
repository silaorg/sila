import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileSystemPersistenceLayer, Space } from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { getToolWriteToFile } from "../../../src/agents/tools/toolWriteToFile";
import { getToolSearchReplacePatch } from "../../../src/agents/tools/toolSearchReplacePatch";

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

    const writeTool = getToolWriteToFile(space);
    const patchTool = getToolSearchReplacePatch(space);

    await writeTool.handler({
      path: "file:///assets/example.txt",
      content: "line1\nline2\nline3\n",
    });

    const patch = `<<<<<<< SEARCH
line2
=======
updated line2
>>>>>>> REPLACE`;

    const result = await patchTool.handler({
      path: "file:///assets/example.txt",
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

    const patchTool = getToolSearchReplacePatch(space);

    const patch = `<<<<<<< SEARCH
=======
brand new content
>>>>>>> REPLACE`;

    const result = await patchTool.handler({
      path: "file:///assets/newfile.md",
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
