<script lang="ts">
  import { onMount } from "svelte";
  import { ClientStateProvider, ClientState } from "@sila/client";
  import { buildSpaceFromConfig } from "$lib/demo/buildSpaceFromConfig";
  import { loadDemoSpace } from "$lib/loadDemoSpace";

  // When not using <SilaApp>, ensure you include styles in the host app if needed

  let { children, state }: { children?: any, state?: ClientState } = $props();

  let demoConfigUrl: string = "/api/demo-space";
  let ready = $state(false);
  let error: string | null = $state(null);
  let localState: ClientState | null = $state(null);

  onMount(async () => {
    if (state) {
      await state.init({});
      const cfg = await (await fetch(demoConfigUrl)).json();
      const built = await buildSpaceFromConfig(cfg);
      await state.adoptInMemorySpace(built, cfg.name);
      ready = true;
    } else {
      try {
        const { state: newState } = await loadDemoSpace({ configUrl: demoConfigUrl });
        localState = newState;
        ready = true;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
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
  {:else if localState}
    <ClientStateProvider instance={localState}>
      {@render children?.()}
    </ClientStateProvider>
  {:else}
    {@render children?.()}
  {/if}
{/if}
