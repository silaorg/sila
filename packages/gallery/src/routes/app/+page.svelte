<script lang="ts">
  import { onMount } from 'svelte';
  import { SilaApp } from '@sila/client';
  import { clientState } from '@sila/client/state/clientState.svelte';
  import { buildSpaceFromConfig } from '$lib/demo/buildSpaceFromConfig';

  let initialized = false;
  let error: string | null = null;

  onMount(async () => {
    try {
      await clientState.init({});
      const res = await fetch('/api/demo-space');
      const config = await res.json();
      const space = await buildSpaceFromConfig(config);
      await clientState.adoptInMemorySpace(space, config.name);
      initialized = true;
    } catch (e) {
      error = (e as Error).message;
    }
  });
</script>

{#if error}
  <div>Error: {error}</div>
{:else if !initialized}
  <div>Loading demo space…</div>
{:else}
  <SilaApp config={{}} />
{/if}

