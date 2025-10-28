<script lang="ts">
  import { onMount } from "svelte";
  import ChatAppInGallery from "$lib/comps/ChatAppInGallery.svelte";
  import { ClientState } from "@sila/client";
  import type { ChatAppData } from "@sila/core";

  let state: ClientState | undefined = $state(undefined);
  let data: ChatAppData | undefined = $state(undefined);

  onMount(async () => {
    state = new ClientState();
    state.init();

    // @TODO: create a dummy space and then chat

    /*
    const chat =demoSpace.newChat():
    chat.setMessages(langMessages);
    demoSpace.chats.length > 0
    */

  });
</script>

{#if state && data}
  <ChatAppInGallery {state} {data} />
{:else}
  <div>Loading...</div>
{/if}
