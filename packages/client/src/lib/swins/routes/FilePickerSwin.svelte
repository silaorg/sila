<script lang="ts">
  import FilesApp from "@sila/client/comps/apps/files/FilesApp.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { Vertex } from "@sila/core";

  const clientState = useClientState();

  let { onPick }: { onPick: (files: Vertex[]) => void } = $props();

  let filesRoot = $derived.by(() => {
    if (!clientState.currentSpace) return undefined;
    return clientState.currentSpace.getVertexByPath("assets");
  });

  let selectedFiles = $state<Vertex[]>([]);

  function isFile(vertex: Vertex) {
    return vertex.getProperty("mimeType") !== undefined;
  }

  let attachableFiles = $derived.by(() => selectedFiles.filter(isFile));

  function handleAttach() {
    if (attachableFiles.length === 0) return;
    onPick?.(attachableFiles);
    clientState.layout.swins.pop();
  }
</script>

<div class="flex flex-col gap-3">
  {#if filesRoot}
    <FilesApp
      filesRoot={filesRoot}
      onSelectionChange={(files) => {
        selectedFiles = files;
      }}
    />
  {:else}
    <p class="text-sm text-surface-600-300">Workspace files are not available.</p>
  {/if}

  <div class="flex items-center justify-end gap-2">
    <button class="btn btn-lg" type="button" onclick={() => clientState.layout.swins.pop()}>
      Cancel
    </button>
    <button
      class="btn btn-lg preset-filled-primary-500"
      type="button"
      onclick={handleAttach}
      disabled={attachableFiles.length === 0}
    >
      Attach
    </button>
  </div>
</div>
