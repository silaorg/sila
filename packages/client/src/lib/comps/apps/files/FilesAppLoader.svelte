<script lang="ts">
  import FilesApp from "./FilesApp.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  let filesRoot = $derived.by(() => {
    if (!clientState.currentSpace) {
      throw new Error("No current space id");
    }

    return clientState.currentSpace.getVertexByPath("assets");
  });
</script>

{#if filesRoot}
  <FilesApp {filesRoot} />
{:else}
  <div>Error loading files root</div>
{/if}
