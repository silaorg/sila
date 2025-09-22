<script lang="ts">
  import { onMount } from 'svelte';
  import { clientState } from '@sila/client/state/clientState.svelte';
  import type { ComponentType } from 'svelte';
  import { buildSpaceFromConfig } from '$lib/demo/buildSpaceFromConfig';

  export let component: ComponentType;
  export let props: Record<string, any> = {};
  export let demoConfigUrl: string = '/api/demo-space';

  let ready = false;
  let error: string | null = null;

  onMount(async () => {
    try {
      await clientState.init({});
      const cfg = await (await fetch(demoConfigUrl)).json();
      const space = await buildSpaceFromConfig(cfg);
      await clientState.adoptInMemorySpace(space, cfg.name);
      ready = true;
    } catch (e) {
      error = (e as Error).message;
    }
  });
</script>

{#if error}
  <div class="p-3 text-red-600">{error}</div>
{:else if !ready}
  <div class="p-3">Loading…</div>
{:else}
  <svelte:component this={component} {...props} />
{/if}

