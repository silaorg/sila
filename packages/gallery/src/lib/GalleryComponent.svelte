<script lang="ts">
  import { onMount } from "svelte";
  import { galleryState } from "$lib/state/galleryState.svelte";
  import { ClientStateProvider, ClientState } from "@sila/client";

  // Ensure component-level styles from @sila/client are available when not using <SilaApp>
  import "@sila/client/compiled-style.css";

  let { children, state }: { children?: any, state?: ClientState } = $props();

  let demoConfigUrl: string = "/api/demo-space";
  let ready = $derived(galleryState.ready);
  let error: string | null = $derived(galleryState.error);

  onMount(async () => {
    await galleryState.loadSpace(demoConfigUrl);
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
