<script lang="ts">
  import ComponentSandbox from '$lib/ComponentSandbox.svelte';
  import ChatAppLoader from '@sila/client/comps/apps/ChatAppLoader.svelte';
  import { clientState } from '@sila/client/state/clientState.svelte';

  let firstChatTreeId: string | null = null;

  $effect(() => {
    const ids = clientState.currentSpace?.getAppTreeIds() || [];
    firstChatTreeId = ids[0] || null;
  });
</script>

<h2>Chat App Sandbox</h2>

<ComponentSandbox>
  {#if firstChatTreeId}
    <ChatAppLoader treeId={firstChatTreeId} />
  {:else}
    <div>Loading…</div>
  {/if}
  </ComponentSandbox>

