<script lang="ts">
  import { onMount } from "svelte";
  import ChatAppInWorkbench from "$lib/comps/ChatAppInWorkbench.svelte";
  import { ClientState } from "@sila/client";
  import type { ChatAppData } from "@sila/core";
  import { createDemoSpace } from "$lib/demo/spaceDemoBuilder";

  let clientState: ClientState | null = null;
  let data: ChatAppData | null = null;

  onMount(async () => {
    clientState = new ClientState();
    await clientState.init();

    const demoSpace = createDemoSpace({ name: "Assistant Responding" });
    const chat = demoSpace.newChat("Demo chat");
    await chat.setMessages([
      { role: "user", text: "Hey" },
      { role: "assistant", text: "Hello, what can I help you with?" },
      { role: "user", text: "What can you do?" },
      {
        role: "tool",
        toolRequests: [
          {
            callId: "1",
            name: "search",
            arguments: { query: "When did Rijani erupt" },
          },
          {
            callId: "2",
            name: "search",
            arguments: { query: "What was the effect of Rijani eruption" },
          },
          {
            callId: "3",
            name: "edit_document",
            arguments: {
              title: "Rijani eruption.md",
              changes: "Summarize the eruption timeline and key impacts.",
            },
          },
          {
            callId: "4",
            name: "generate_image",
            arguments: {
              prompt:
                "Eruption of Rijani at dusk, ash plume towering over a coastal village, dramatic light, cinematic composition, long descriptive sentence that fades into the distance",
            },
          },
        ],
      },
      {
        role: "tool-results",
        toolResults: [
          {
            toolId: "1",
            name: "search",
            result: {
              results: [
                {
                  title: "Rijani (Rinjani) eruption timeline",
                  snippet:
                    "Historical activity reports note multiple eruptive periods in the 19th and 20th centuries.",
                },
                {
                  title: "Mount Rinjani eruptions overview",
                  snippet:
                    "Key eruptions reshaped the summit caldera and affected nearby settlements.",
                },
              ],
            },
          },
          {
            toolId: "2",
            name: "search",
            result: {
              results: [
                {
                  title: "Environmental impacts of the Rijani eruption",
                  snippet:
                    "Ashfall disrupted agriculture and caused short-term air quality issues.",
                },
                {
                  title: "Societal effects of major eruptions",
                  snippet:
                    "Transport delays and temporary evacuations were reported in nearby regions.",
                },
              ],
            },
          },
        ],
      },
    ]);

    // Attach demo space to ClientState (in-memory) and set current chat data
    await clientState.addDemoSpace(demoSpace.getSpace(), demoSpace.name);
    data = chat.get();
  });
</script>

{#if clientState && data}
  <ChatAppInWorkbench {clientState} {data} />
{:else}
  <div>Loading...</div>
{/if}
