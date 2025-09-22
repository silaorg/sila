<script lang="ts">
  import ChatApp from '@sila/client/comps/apps/ChatApp.svelte';
  import { ChatAppData } from '@sila/core';
  import { clientState } from '@sila/client/state/clientState.svelte';
  import { onMount } from 'svelte';

  let { treeId }: { treeId: string } = $props();

  let data: ChatAppData | null = $state(null);

  async function tryBuild() {
    if (!clientState.currentSpace) return;
    const appTree = clientState.currentSpace.getAppTree(treeId) || await clientState.currentSpace.loadAppTree(treeId);
    if (appTree) {
      data = new ChatAppData(clientState.currentSpace, appTree);
    }
  }

  onMount(async () => {
    await tryBuild();
  });

  $effect(async () => {
    // Re-attempt when currentSpace becomes available or treeId changes
    await tryBuild();
  });
</script>

{#if data}
  <ChatApp {data} />
{:else}
  <div>Error loading app tree</div>
{/if}

