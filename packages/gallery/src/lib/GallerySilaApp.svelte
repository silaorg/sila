<script lang="ts">
  import { onMount } from "svelte";
  import { SilaApp, ClientStateProvider, ClientState } from "@sila/client";
  import { galleryState } from "$lib/state/galleryState.svelte";

  let demoConfigUrl: string = "/api/demo-space";
  let initialized = $derived(galleryState.ready);
  let error: string | null = $derived(galleryState.error);

  onMount(async () => {
    const localState = new ClientState();
    galleryState.setClient(localState);
    await galleryState.loadSpace(demoConfigUrl);
  });
</script>

{#if error}
  <div>Error: {error}</div>
{:else if !initialized}
  <div>Loading demo space…</div>
{:else}
  {#key initialized}
    {#if initialized}
      <SilaApp config={{}} state={galleryState["_client"]} />
    {:else}
      <div>Loading, please wait…</div>
    {/if}
  {/key}
{/if}
