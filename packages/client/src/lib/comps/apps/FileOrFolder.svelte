<script lang="ts">
  import type { Vertex } from "@sila/core";
  import FolderItem from "./FolderItem.svelte";
  import FileItem from "./FileItem.svelte";

  let {
    vertex,
    onEnter,
    treeId,
  }: {
    vertex: Vertex;
    onEnter: (folder: Vertex) => void;
    treeId: string;
  } = $props();

  function isFolder(v: Vertex): boolean {
    return v.getProperty("mimeType") === undefined;
  }
</script>

{#if isFolder(vertex)}
  <FolderItem {vertex} {onEnter} />
{:else}
  <FileItem {vertex} {treeId} />
{/if}

