<script lang="ts">
  import { onMount } from 'svelte';
  import { clientState } from '@sila/client/state/clientState.svelte';
  import type { Space } from '@sila/core';
  import { buildSpaceFromConfig } from '$lib/demo/buildSpaceFromConfig';
  // Ensure component-level styles from @sila/client are available when not using <SilaApp>
  import '@sila/client/compiled-style.css';

  // Optional externally provided space; if not provided, the sandbox will load one
  export let space: Space | null = null;
  export let demoConfigUrl: string = '/api/demo-space';
  export let autoLoad: boolean = true;

  let ready = false;
  let error: string | null = null;

  onMount(async () => {
    try {
      await clientState.init({});
      if (space) {
        await clientState.adoptInMemorySpace(space, space.name || 'Sandbox Space');
      } else if (autoLoad) {
        const cfg = await (await fetch(demoConfigUrl)).json();
        const built = await buildSpaceFromConfig(cfg);
        await clientState.adoptInMemorySpace(built, cfg.name);
      }
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
  <slot />
{/if}

