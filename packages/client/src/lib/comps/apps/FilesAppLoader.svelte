<script lang="ts">
  import FilesApp from "./FilesApp.svelte";
  import { FilesAppData } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  let { treeId }: { treeId: string } = $props();

  let data = $derived.by(async () => {
    if (!clientState.currentSpace) {
      throw new Error("No current space id");
    }

    const appTree = await clientState.currentSpace.loadAppTree(treeId);
    if (!appTree) {
      throw new Error("Failed to load app tree");
    }

    return new FilesAppData(clientState.currentSpace, appTree);
  });
</script>

{#await data}
  <div></div>
{:then data}
  <FilesApp {data} />
{:catch}
  <div>Error loading app tree</div>
{/await}
