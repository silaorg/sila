<script lang="ts">
  import ChatApp from "./ChatApp.svelte";
  import { ChatAppData } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { i18n } from "@sila/client";

  let { treeId }: { treeId: string } = $props();

  const clientState = useClientState();
  let data = $derived.by(async () => {
    if (!clientState.currentSpace) {
      throw new Error("No current space id");
    }

    const appTree = await clientState.currentSpace.loadAppTree(treeId);
    if (!appTree) {
      throw new Error("Failed to load app tree");
    }

    return new ChatAppData(clientState.currentSpace, appTree);
  });
</script>

{#await data}
  <div></div>
{:then data}
  <ChatApp {data} />
{:catch}
  <div>{i18n.texts.chat.errorLoadingAppTree}</div>
{/await}
