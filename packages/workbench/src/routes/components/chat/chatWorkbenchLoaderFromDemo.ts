import { type ClientState } from "@sila/client";
import { ChatAppData } from "@sila/core";
import { loadDemoSpace } from "$lib/loadDemoSpace";

const demoConfigUrl: string = "/api/demo-space";

export async function loadFromDemoSpace(): Promise<{ state: ClientState; data: ChatAppData }> {
  const { state } = await loadDemoSpace({ configUrl: demoConfigUrl });
  const data = await loadChatAppDataFromState(state);
  return { state, data };
}

async function loadChatAppDataFromState(state: ClientState): Promise<ChatAppData> {
  const space = state.currentSpace;
  if (!space) {
    throw new Error("No space loaded");
  }

  // Pick the first threads child and read its 'tid' (actual AppTree id)
  const first = space.appTreesVertex.children[0];
  if (!first) {
    throw new Error("No apps found in space");
  }

  const treeId = first.getProperty("tid") as string | undefined;
  if (!treeId) {
    throw new Error("Invalid app tree reference");
  }

  const appTree = space.getAppTree(treeId) || (await space.loadAppTree(treeId));
  if (!appTree) {
    throw new Error("Failed to load app tree");
  }

  return new ChatAppData(space, appTree);
}


