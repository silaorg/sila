<script lang="ts">
  import ChatAppInGallery from "$lib/comps/ChatAppInGallery.svelte";
  import { onMount } from "svelte";
  import { loadFromDemoSpace } from "./chatGalleryLoaderFromDemo";
  import type { ClientState } from "@sila/client";
  import type { ChatAppData } from "@sila/core";

  let clientState: ClientState | undefined = $state(undefined);
  let data: ChatAppData | undefined = $state(undefined);

  onMount(async () => {
    const stateAndData = await loadFromDemoSpace();
    data = stateAndData.data;
    clientState = stateAndData.state;
  });
</script>

{#if clientState && data}
  <ChatAppInGallery {clientState} {data} />
{:else}
  <div>Loading...</div>
{/if}