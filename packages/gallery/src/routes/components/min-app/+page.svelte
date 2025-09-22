<script lang="ts">
  import { onMount } from 'svelte';
  import { ClientState, ClientStateProvider, SilaApp } from '@sila/client';
  import { buildSpaceFromConfig } from '$lib/demo/buildSpaceFromConfig';

  const state = new ClientState();
  const demoConfigUrl: string = '/api/demo-space';
  let ready = $state(false);

  onMount(async () => {
    await state.init({});
    const cfg = await (await fetch(demoConfigUrl)).json();
    const built = await buildSpaceFromConfig(cfg);
    await state.adoptInMemorySpace(built, cfg.name);
    ready = true;
  });
</script>

{#if !ready}
  <div>Loading…</div>
{:else}
  <ClientStateProvider instance={state}>
    <SilaApp config={{}} state={state} />
  </ClientStateProvider>
{/if}

