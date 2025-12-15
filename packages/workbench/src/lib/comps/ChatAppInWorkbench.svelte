<script lang="ts">
  import { ClientStateProvider, type ClientState } from "@sila/client";
  import ChatApp from "@sila/client/comps/apps/chat/ChatApp.svelte";
  import { ChatAppData } from "@sila/core";

  let { clientState, data }: { clientState: ClientState; data: ChatAppData } = $props();
</script>

<ClientStateProvider instance={clientState}>
  <ChatApp {data} />
</ClientStateProvider>


