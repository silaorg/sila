<script lang="ts">
  import { onMount } from "svelte";
  import { galleryState } from "$lib/state/galleryState.svelte";
  import { ClientStateProvider, ClientState } from "@sila/client";
  import { buildSpaceFromConfig } from "$lib/demo/buildSpaceFromConfig";

  // When not using <SilaApp>, ensure you include styles in the host app if needed

  let { children, state }: { children?: any, state?: ClientState } = $props();

  let demoConfigUrl: string = "/api/demo-space";
  let ready = $derived(galleryState.ready);
  let error: string | null = $derived(galleryState.error);

  onMount(async () => {
    if (state) {
      await state.init({});
      const cfg = await (await fetch(demoConfigUrl)).json();
      const built = await buildSpaceFromConfig(cfg);
      await state.adoptInMemorySpace(built, cfg.name);
    } else {
      await galleryState.loadSpace(demoConfigUrl);
    }
  });
</script>

{#if error}
  <div class="p-3 text-red-600">{error}</div>
{:else if !ready}
  <div class="p-3">Loading…</div>
{:else}
  {#if state}
    <ClientStateProvider instance={state}>
      {@render children?.()}
    </ClientStateProvider>
  {:else}
    {@render children?.()}
  {/if}
{/if}
