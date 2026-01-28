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
            name: "read",
            arguments: { url: "https://example.com/rijani-eruption-report" },
          },
          {
            callId: "4",
            name: "edit_document",
            arguments: {
              title: "Rijani eruption.md",
              changes: "Summarize the eruption timeline and key impacts.",
            },
          },
          {
            callId: "5",
            name: "generate_image",
            arguments: {
              prompt:
                "Eruption of Rijani at dusk, ash plume towering over a coastal village, dramatic light, cinematic composition, long descriptive sentence that fades into the distance",
            },
          },
          {
            callId: "6",
            name: "search",
            arguments: { query: "Rijani ashfall health effects guidance" },
          },
          {
            callId: "7",
            name: "read",
            arguments: { url: "https://example.com/volcano-alerts/rijani" },
          },
          {
            callId: "8",
            name: "summarize",
            arguments: { title: "Rijani field notes", maxPoints: 5 },
          },
          {
            callId: "9",
            name: "write_document",
            arguments: { title: "Rijani FAQ.md", outline: true },
          },
          {
            callId: "10",
            name: "generate_image",
            arguments: {
              prompt:
                "Aerial view of volcanic caldera, wide-angle, misty atmosphere, subtle color palette, documentary style",
            },
          },
          {
            callId: "11",
            name: "apply_search_replace_patch",
            arguments: {
              patch:
                "file:///assets/Time zone map redesign.md <<<<<<< SEARCH ======= # Nicer world time zones illustration (prompt + spec) ## Image generator prompt (vector infographic) Create a clean **vector-style editorial infographic** of a **world map with standard time zones**. - **Projection:** Robinson (or Winkel Tripel), centered on the Atlantic (Greenwich near center) - **Base map:** simplified continents, no internal country borders (or very faint), no city labels - **Ocean:** very light blue-gray - **Land:** warm light neutral (sand/stone) with subtle coastline stroke - **Time zones:** vertical bands spanning pole-to-pole with **crisp edges**; include the well-known **jogs** (political boundary exceptions) but keep them visually tidy (rounded corners, simplified small islands) - **Color system:** alternating calm pastel bands with a systematic palette; add a subtle gradient across the day from west (cool) to east (warm) - **Labels:** UTC offsets along **top and bottom** for each band: **UTC−12 to UTC+14**; clear tick marks - **Highlights:** thin emphasized line at **UTC±0 (Greenwich)** and a labeled **International Date Line** in the Pacific - **Typography:** modern sans-serif (Inter / Source Sans), consistent hierarchy, no heavy all-caps - **Legend:** small box explaining “Offsets shown are standard time; many regions observe daylight saving time” - **Overall:** lots of whitespace, print-poster quality, crisp, minimal clutter **Output:** 4K, sharp, clean lines, no blur, no texture ### Negative prompt satellite imagery, photorealistic, excessive country labels, dense callout boxes, clutter, noisy background, low-resolution text, distorted geography, watermark, logo ## Suggested palette (hex) - Ocean: `#EAF1F6` - Land: `#F2E8D5` - Coastline: `#3A3A3A` at 30–40% opacity - Zone band set (alternate): `#D7EEF2`, `#E8F2D7`, `#F2E1D7`, `#E2E2F2` - Greenwich line: `#1F6FEB` - Date line: `#D1242F` - Text: `#1F2937` ## Layout tweaks vs your current map - Keep only **major labels** (UTC offsets + Date Line + UTC note) - Replace many tiny island callouts with **two clean insets** (Pacific islands, Australia/SE Asia) - Use label halos (2–3 px) where text crosses bands",
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
