import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ChatAppData, Space, SpaceManager, FileSystemPersistenceLayer } from "@sila/core";
import { buildChatSearchEntries } from "@sila/client/utils/chatSearch";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const CHAT_SEARCH_INDEX_UUID = "00000000-0000-0000-0000-000000000001";

describe("chat search index corruption", () => {
  let tempDir: string;
  let space: Space;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-chat-search-test-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    const fs = new NodeFileSystem();
    space = Space.newSpace(crypto.randomUUID());
    const layer = new FileSystemPersistenceLayer(tempDir, space.getId(), fs);
    const manager = new SpaceManager();
    await manager.addNewSpace(space, [layer]);
  });

  it("rebuilds when the stored index is malformed", async () => {
    const appTree = ChatAppData.createNewChatTree(space, "assistant");
    space.setAppTreeName(appTree.getId(), "Corrupt index test");
    const chat = new ChatAppData(space, appTree);
    await chat.newMessage({ role: "user", text: "hello from chat search" });

    const corrupt = JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      entries: [{ threadId: "bad", title: "Bad", messages: "nope" }],
    });
    const store = space.fileStore;
    expect(store).toBeTruthy();
    await store!.putMutable(CHAT_SEARCH_INDEX_UUID, new TextEncoder().encode(corrupt));

    const entries = await buildChatSearchEntries(space);

    expect(entries.length).toBe(1);
    expect(entries[0].threadId).toBe(appTree.getId());
    expect(entries[0].messages).toContain("hello from chat search");
  });
});
