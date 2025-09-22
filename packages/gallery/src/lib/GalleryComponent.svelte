<script lang="ts">
  import { onMount } from "svelte";
  import { galleryState } from "$lib/state/galleryState.svelte";

  // Ensure component-level styles from @sila/client are available when not using <SilaApp>
  import "@sila/client/compiled-style.css";

  let { children } = $props();

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
  {@render children?.()}
{/if}
