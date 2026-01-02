<script lang="ts">
  import FilesApp from "./FilesApp.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { Vertex } from "@sila/core";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  let {
    filesRoot,
    onFileOpen,
    onSelectionChange,
  }: {
    filesRoot?: Vertex;
    onFileOpen?: (file: Vertex) => void;
    onSelectionChange?: (files: Vertex[]) => void;
  } = $props();

  let targetFilesRoot = $derived.by(() => {
    // If the file root wasn't set - use the workspaces's files root
    if (filesRoot) {
      return filesRoot;
    }

    if (!clientState.currentSpace) {
      throw new Error("No current space id");
    }

    return clientState.currentSpace.getVertexByPath("assets");
  });
</script>

{#if targetFilesRoot}
  <FilesApp filesRoot={targetFilesRoot} {onFileOpen} {onSelectionChange} />
{:else}
  <div>{i18n.texts.filesApp.errorLoadingFilesRoot}</div>
{/if}
