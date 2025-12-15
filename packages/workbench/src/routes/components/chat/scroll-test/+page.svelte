<script lang="ts">
  import { onMount } from "svelte";
  import ChatAppInWorkbench from "$lib/comps/ChatAppInWorkbench.svelte";
  import { ClientState } from "@sila/client";
  import type { ChatAppData } from "@sila/core";
  import { createDemoSpace } from "$lib/demo/spaceDemoBuilder";
  import { LangMessage } from "aiwrapper";

  let clientState: ClientState | null = null;
  let data: ChatAppData | null = null;

  // Generate a large message for testing scroll behavior
  function generateLargeMessage(): string {
    const paragraphs = [];
    for (let i = 0; i < 50; i++) {
      paragraphs.push(
        `This is paragraph ${i + 1} of a long message designed to test scroll behavior. ` +
        `It contains enough content to require scrolling in the chat interface. ` +
        `The message should be long enough to test both auto-scroll functionality and ` +
        `the ability to scroll up and down without the view jumping back to the bottom. ` +
        `Each paragraph adds more content to ensure the message extends well beyond ` +
        `the visible viewport, allowing us to verify that the scroll behavior works ` +
        `correctly when content is streaming in or when the user manually scrolls. ` +
        `We want to ensure that users can freely navigate the conversation history ` +
        `without being forced back to the bottom, while still maintaining smooth ` +
        `auto-scrolling when new content arrives and the user is already at the bottom.`
      );
    }
    return paragraphs.join("\n\n");
  }

  // Simulate streaming by updating message text progressively
  async function simulateStreaming(data: ChatAppData, messageText: string) {
    const words = messageText.split(/\s+/);
    let accumulatedText = "";
    
    // Create initial in-progress message
    const messageVertex = data.newLangMessage(
      new LangMessage("assistant", ""),
      true
    );

    // Stream words progressively
    for (let i = 0; i < words.length; i++) {
      accumulatedText += (i > 0 ? " " : "") + words[i];
      
      // Update every few words to simulate streaming
      if (i % 10 === 0 || i === words.length - 1) {
        messageVertex.$useTransients((m: any) => {
          m.text = accumulatedText;
        });
        
        // Small delay to make streaming visible
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    }

    // Mark as complete
    messageVertex.$useTransients((m: any) => {
      m.inProgress = false;
      m.text = accumulatedText;
    });
  }

  onMount(async () => {
    clientState = new ClientState();
    await clientState.init();

    const demoSpace = createDemoSpace({ name: "Scroll Test" });
    const chat = demoSpace.newChat("Scroll Test Chat");
    
    // Set up initial user message
    await chat.setMessages([
      {
        role: "user",
        text: "Please write a very long, detailed response about artificial intelligence, machine learning, and their applications."
      }
    ]);

    // Attach demo space to ClientState
    await clientState.addDemoSpace(demoSpace.getSpace(), demoSpace.name);
    data = chat.get();

    // Simulate streaming a large response
    const largeMessage = generateLargeMessage();
    simulateStreaming(data, largeMessage);
  });
</script>

{#if clientState && data}
  <ChatAppInWorkbench {clientState} {data} />
{:else}
  <div>Loading...</div>
{/if}

