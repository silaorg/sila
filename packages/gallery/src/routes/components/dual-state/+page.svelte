<script lang="ts">
  import { onMount } from 'svelte';
  import { GalleryComponent } from '$lib';
  import { ClientState, ClientStateProvider } from '@sila/client';
  import ChatAppInGallery from '$lib/comps/ChatAppInGallery.svelte';
  import { buildSpaceFromConfig } from '$lib/demo/buildSpaceFromConfig';

  const stateA = new ClientState();
  const stateB = new ClientState();

  const demoConfigUrl: string = '/api/demo-space';
  let readyA = $state(false);
  let readyB = $state(false);

  onMount(async () => {
    await stateA.init({});
    await stateB.init({});
    const cfg = await (await fetch(demoConfigUrl)).json();
    const builtA = await buildSpaceFromConfig(cfg);
    const builtB = await buildSpaceFromConfig(cfg);
    await stateA.adoptInMemorySpace(builtA, cfg.name + ' A');
    await stateB.adoptInMemorySpace(builtB, cfg.name + ' B');
    readyA = true; readyB = true;
  });
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
  <div class="border rounded">
    {#if readyA}
      <ClientStateProvider instance={stateA}>
        <GalleryComponent state={stateA}>
          <ChatAppInGallery />
        </GalleryComponent>
      </ClientStateProvider>
    {:else}
      <div class="p-3">Loading…</div>
    {/if}
  </div>
  <div class="border rounded">
    {#if readyB}
      <ClientStateProvider instance={stateB}>
        <GalleryComponent state={stateB}>
          <ChatAppInGallery />
        </GalleryComponent>
      </ClientStateProvider>
    {:else}
      <div class="p-3">Loading…</div>
    {/if}
  </div>
</div>

