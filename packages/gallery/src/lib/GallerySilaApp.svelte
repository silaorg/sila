<script lang="ts">
  import { onMount } from "svelte";
  import { SilaApp } from "@sila/client";
  import { galleryState } from "$lib/state/galleryState.svelte";

  let demoConfigUrl: string = "/api/demo-space";
  let initialized = $derived(galleryState.ready);
  let error: string | null = $derived(galleryState.error);

  onMount(async () => {
    await galleryState.loadSpace(demoConfigUrl);
  });
</script>

{#if error}
  <div>Error: {error}</div>
{:else if !initialized}
  <div>Loading demo space…</div>
{:else}
  <SilaApp config={{}} />
{/if}
