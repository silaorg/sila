<script lang="ts">
  import { onMount } from "svelte";
  import { ClientStateProvider, type ClientState } from "@sila/client";
  import ChatApp from "@sila/client/comps/apps/chat/ChatApp.svelte";
  import { ChatAppData } from "@sila/core";
  import { loadDemoSpace } from "$lib/loadDemoSpace";

  let demoConfigUrl: string = "/api/demo-space";
  let loading = $state(true);
  let error: string | null = $state(null);
  let data: ChatAppData | null = $state(null);
  let localState: ClientState | null = $state(null);

  onMount(async () => {
    try {
      const { state } = await loadDemoSpace({ configUrl: demoConfigUrl });
      localState = state;
      await buildFromFirstChatTree(state);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  async function buildFromFirstChatTree(state: ClientState) {
    const space = state.currentSpace;
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
