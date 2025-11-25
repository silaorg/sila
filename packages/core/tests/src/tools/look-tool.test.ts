import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("@fal-ai/client", () => ({
  createClient: () => ({
    images: { run: vi.fn() },
    videos: { run: vi.fn() },
  }),
}));
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { LangMessage, LangMessages, type LanguageProvider } from "aiwrapper";
import { Space, FileSystemPersistenceLayer, ChatAppData } from "@sila/core";
import { NodeFileSystem } from "../setup/setup-node-file-system";
import { getToolLook } from "../../../src/agents/tools/toolLook";

describe("look tool", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-look-tool-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("describes an attached image referenced via file: URI", async () => {
    const fs = new NodeFileSystem();
    const space = Space.newSpace(crypto.randomUUID());
    const spaceId = space.getId();

    const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
    if (typeof (layer as any).getFileStoreProvider === "function") {
      space.setFileStoreProvider((layer as any).getFileStoreProvider());
    }

    const chatTree = ChatAppData.createNewChatTree(space, "test-config");
    const chatData = new ChatAppData(space, chatTree);

    const base64Path = path.join(__dirname, "../../assets/images/cat-1px.b64");
    const base64 = (await readFile(base64Path, "utf8")).trim();
    const dataUrl = `data:image/png;base64,${base64}`;

    await chatData.newMessage({
      role: "user",
      text: "Adding cat image",
      attachments: [
        {
          id: "cat-img",
          kind: "image",
          name: "cat.png",
          mimeType: "image/png",
          size: base64.length,
          width: 1,
          height: 1,
          dataUrl,
        },
      ],
    });

    const providerFactory = vi.fn<() => Promise<LanguageProvider>>().mockResolvedValue({
      chat: async (input: LangMessages | LangMessage[]) => {
        const messages = input instanceof LangMessages ? input : new LangMessages(input as any);
        const result = new LangMessages(Array.from(messages));
        result.addAssistantMessage("A tiny pixel cat sitting on a transparent background.");
        return result as any;
      },
    } as any);

    const lookTool = getToolLook(space, chatTree, providerFactory);
    const description = await lookTool.handler({
      prompt: "Describe the colors of the cat.",
      uri: "file:cat.png",
    });

    expect(description).toBe("A tiny pixel cat sitting on a transparent background.");
    expect(providerFactory).toHaveBeenCalledOnce();
  });
});
