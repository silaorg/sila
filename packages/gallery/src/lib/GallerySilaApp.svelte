<script lang="ts">
  import { onMount } from "svelte";
  import { SilaApp, ClientStateProvider, ClientState } from "@sila/client";
  import { galleryState } from "$lib/state/galleryState.svelte";

  let demoConfigUrl: string = "/api/demo-space";
  let initialized = $derived(galleryState.ready);
  let error: string | null = $derived(galleryState.error);

  // Allow passing a custom state for isolation if needed
  let { state }: { state?: ClientState } = $props();

  onMount(async () => {
    const localState = state || new ClientState();
    galleryState.setClient(localState);
    await galleryState.loadSpace(demoConfigUrl);
  });
</script>

{#if error}
  <div>Error: {error}</div>
{:else if !initialized}
  <div>Loading demo space…</div>
{:else}
  {#if state}
    <ClientStateProvider instance={state}>
      <SilaApp config={{}} state={state} />
    </ClientStateProvider>
  {:else}
    {#key initialized}
      {#if initialized}
        <!-- When we create local state above, we need to pass the same instance used by galleryState -->
        <ClientStateProvider instance={galleryState["_client"]}>
          <SilaApp config={{}} state={galleryState["_client"]} />
        </ClientStateProvider>
      {:else}
        <SilaApp config={{}} />
      {/if}
    {/key}
  {/if}
{/if}
