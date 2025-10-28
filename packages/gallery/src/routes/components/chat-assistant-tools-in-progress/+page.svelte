<script lang="ts">
  import { onMount } from "svelte";
  import ChatAppInGallery from "$lib/comps/ChatAppInGallery.svelte";
  import { ClientState } from "@sila/client";
  import type { ChatAppData } from "@sila/core";
  import { createDemoSpace } from "$lib/demo/spaceDemoBuilder";
  import { LangMessages } from "aiwrapper";

  let state: ClientState | null = null;
  let data: ChatAppData | null = null;

  onMount(async () => {
    state = new ClientState();
    await state.init();

    const demoSpace = createDemoSpace({ name: "Assistant Responding" });
    const chat = demoSpace.newChat("Lang test");
    const langMessages = new LangMessages([
      { role: "user", content: "Hey" },
      { role: "assistant", content: "Hello, what can I help you with?" },
      { role: "user", content: "What can you do?" },
      { role: "tool", content: [{ callId: "1", name: "read", arguments: { uri: "https://example.com" } }] },
    ]);
    chat.setMessages(langMessages);

    // Attach demo space to ClientState (in-memory) and set current chat data
    await state.addDemoSpace(demoSpace.getSpace(), demoSpace.name);
    data = chat.get();

  });
</script>

{#if state && data}
  <ChatAppInGallery {state} {data} />
{:else}
  <div>Loading...</div>
{/if}
