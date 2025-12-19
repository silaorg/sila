import { describe, it, expect } from "vitest";
import {
  ChatAppData,
  Space,
  transformFileReferencesToPaths,
  transformPathsToFileReferences,
} from "@sila/core";

describe("markdown file references (fref:)", () => {
  it("rewrites inline markdown file links to fref on save and back to file: on display", async () => {
    const space = Space.newSpace(crypto.randomUUID());
    const chatTree = ChatAppData.createNewChatTree(space, "default");
    const chatData = new ChatAppData(space, chatTree);

    // Workspace file under /assets
    const assetsRoot = space.getVertexByPath("assets")!;
    const wsDoc = assetsRoot.newNamedChild("doc.md");
    wsDoc.setProperty("mimeType", "text/markdown");

    // Chat-scoped file under chat assets
    const chatAssetsRoot = chatData.getFilesRoot(true)!;
    const chatImg = chatAssetsRoot.newNamedChild("pic.png");
    chatImg.setProperty("mimeType", "image/png");

    const input = [
      `See [doc](file:///assets/doc.md "title")`,
      `and ![pic](file:pic.png)`,
      ``,
      "```md",
      `[do-not-touch](file:///assets/doc.md)`,
      "```",
    ].join("\n");

    const saved = await transformPathsToFileReferences(input, {
      spaceId: space.getId(),
      fileResolver: space.fileResolver,
      relativeRootVertex: chatAssetsRoot,
      relativeTreeId: chatData.threadId,
    });

    expect(saved).toContain(`(fref:${wsDoc.id}@${space.getId()} "title")`);
    expect(saved).toContain(`(fref:${chatImg.id}@${chatData.threadId})`);
    // Code blocks should be ignored by the transform.
    expect(saved).toContain(`[do-not-touch](file:///assets/doc.md)`);

    // Rename/move within each tree (vertex ids stay stable).
    wsDoc.name = "doc-renamed.md";
    chatImg.name = "pic-renamed.png";

    const { markdown: displayed } = await transformFileReferencesToPaths(saved, {
      space,
      fileResolver: space.fileResolver,
      candidateTreeIds: [chatData.threadId, space.getId()],
    });

    expect(displayed).toContain(`(file:///assets/doc-renamed.md "title")`);
    // Chat paths currently include the assets folder prefix (file:assets/...)
    expect(displayed).toContain(`(file:assets/pic-renamed.png)`);
    // Still untouched in code block.
    expect(displayed).toContain(`[do-not-touch](file:///assets/doc.md)`);
  });
});

