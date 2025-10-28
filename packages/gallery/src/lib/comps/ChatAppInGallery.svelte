<script lang="ts">
  import { ClientStateProvider, type ClientState } from "@sila/client";
  import ChatApp from "@sila/client/comps/apps/chat/ChatApp.svelte";
  import { ChatAppData } from "@sila/core";

  let { state, data }: { state: ClientState; data: ChatAppData } = $props();
</script>

<ClientStateProvider instance={state}>
  <ChatApp {data} />
</ClientStateProvider>
