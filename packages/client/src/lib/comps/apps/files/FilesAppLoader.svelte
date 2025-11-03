<script lang="ts">
  import FilesApp from "./FilesApp.svelte";
  import { AppTree, FilesAppData } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  let { treeId }: { treeId?: string } = $props();

  let data = $derived.by(async () => {
    if (!clientState.currentSpace) {
      throw new Error("No current space id");
    }

    let filesAppTree: AppTree | undefined;

    if (treeId) {
      filesAppTree = await clientState.currentSpace.loadAppTree(treeId);
    } else {
      filesAppTree = await FilesAppData.getOrCreateDefaultFilesTree(
        clientState.currentSpace
      );
    }

    if (!filesAppTree) {
      throw new Error("Failed to load app tree");
    }

    return new FilesAppData(clientState.currentSpace, filesAppTree);
  });
</script>

{#await data}
  <div></div>
{:then data}
  <FilesApp {data} />
{:catch}
  <div>Error loading app tree</div>
{/await}
