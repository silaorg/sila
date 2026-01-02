<script lang="ts">
  import FilesApp from "@sila/client/comps/apps/files/FilesApp.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { Vertex } from "@sila/core";

  const clientState = useClientState();

  let { onPick }: { onPick: (file: Vertex) => void } = $props();

  let filesRoot = $derived.by(() => {
    if (!clientState.currentSpace) return undefined;
    return clientState.currentSpace.getVertexByPath("assets");
  });

  function handlePick(file: Vertex) {
    onPick?.(file);
    clientState.layout.swins.pop();
  }
</script>

<div class="flex flex-col gap-3">
  <p class="text-sm text-surface-600-300">
    Double click a file to attach it to your message.
  </p>

  {#if filesRoot}
    <FilesApp filesRoot={filesRoot} onFilePick={handlePick} />
  {:else}
    <p class="text-sm text-surface-600-300">Workspace files are not available.</p>
  {/if}
</div>
