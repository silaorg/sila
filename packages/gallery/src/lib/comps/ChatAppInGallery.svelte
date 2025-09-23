<script lang="ts">
  import { onMount } from "svelte";
  import { SilaApp, ClientStateProvider, ClientState } from "@sila/client";
  import { galleryState } from "$lib/state/galleryState.svelte";
  import ChatApp from "@sila/client/comps/apps/ChatApp.svelte";
  import { ChatAppData } from "@sila/core";

  let demoConfigUrl: string = "/api/demo-space";
  let initialized = $derived(galleryState.ready);
  let error: string | null = $derived(galleryState.error);
  let data: ChatAppData | null = $state(null);
  let localState: ClientState | null = $state(null);

  onMount(async () => {
    localState = new ClientState();
    galleryState.setClient(localState);
    await galleryState.loadSpace(demoConfigUrl);

    await buildFromFirstChatTree();
  });

  async function buildFromFirstChatTree() {
    const space = galleryState.currentSpace;
    if (!space) {
      error = "No space loaded";
      return;
    }

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
  
</script>

{#if data && localState}
  <ClientStateProvider instance={localState}>
    <ChatApp {data} />
  </ClientStateProvider>
{:else if error}
  <div>Error loading app tree{error ? `: ${error}` : ''}</div>
{:else}
  <div>Loading...</div>
{/if}
