<script lang="ts">
  import ChatApp from "@sila/client/comps/apps/ChatApp.svelte";
  import { ChatAppData } from "@sila/core";
  import { galleryState } from "$lib/state/galleryState.svelte";
  import { onMount } from "svelte";

  let data: ChatAppData | null = $state(null);
  let error: string | null = $state(null);
  let demoConfigUrl: string = "/api/demo-space";

  async function buildFromFirstChatTree() {
    const space = galleryState.currentSpace;
    if (!space) return;

    // Pick the first app-forest child and read its 'tid' (actual AppTree id)
    const first = space.appTreesVertex.children[0];
    if (!first) {
      error = "No apps found in space";
      return;
    }

    const treeId = first.getProperty("tid") as string | undefined;
    if (!treeId) {
      error = "Invalid app tree reference";
      return;
    }

    const appTree = space.getAppTree(treeId) || await space.loadAppTree(treeId);
    if (!appTree) {
      error = "Failed to load app tree";
      return;
    }

    data = new ChatAppData(space, appTree);
  }

  onMount(async () => {
    await galleryState.loadSpace(demoConfigUrl);
    await buildFromFirstChatTree();
  });
  
</script>

{#if data}
  <ChatApp {data} />
{:else}
  <div>Error loading app tree{error ? `: ${error}` : ''}</div>
{/if}
