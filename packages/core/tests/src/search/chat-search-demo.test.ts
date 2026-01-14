import { describe, expect, it } from "vitest";
import demoConfig from "../../../../demo/examples/citybean-coffee.json";
import { ChatAppData, Space, uuid } from "@sila/core";
import {
  buildChatSearchEntries,
  searchChatThreads,
} from "@sila/client/utils/chatSearch";

describe("chat search demo index", () => {
  it("indexes CityBean demo conversations without UI", async () => {
    const demo = demoConfig as typeof demoConfig;

    const space = await buildSpaceFromConfig(demo);
    const entries = await buildChatSearchEntries(space);
    const results = searchChatThreads(entries, "pumpkin latte");

    expect(entries.length).toBeGreaterThan(0);
    expect(results.some((result) => result.title === "Pumpkin Latte Sales")).toBe(true);
  }, 20000);
});

async function buildSpaceFromConfig(config: typeof demoConfig): Promise<Space> {
  const space = Space.newSpace(uuid());
  space.name = config.name;

  for (const assistant of config.assistants) {
    space.addAppConfig({
      id: assistant.id,
      name: assistant.name,
      button: assistant.button,
      visible: assistant.visible ?? true,
      description: assistant.description,
      instructions: assistant.instructions,
      targetLLM: assistant.targetLLM,
    });
  }

  for (const provider of config.providers) {
    if (provider.apiKey) {
      space.saveModelProviderConfig({
        id: provider.id,
        type: "cloud",
        apiKey: provider.apiKey,
      });
    }
  }

  for (const conversation of config.conversations) {
    const appTree = ChatAppData.createNewChatTree(space, conversation.assistant);
    space.setAppTreeName(appTree.getId(), conversation.title);
    const chat = new ChatAppData(space, appTree);
    await addMessages(chat, conversation.messages);
  }

  return space;
}

async function addMessages(chat: ChatAppData, node: (typeof demoConfig)["conversations"][number]["messages"]): Promise<void> {
  await chat.newMessage({ role: node.role, text: node.text });
  if (node.children) {
    for (const child of node.children) {
      await addMessages(chat, child);
    }
  }
}
