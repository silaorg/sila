<script lang="ts">
  import type { Vertex } from "@sila/core";
  import FolderItem from "./FolderItem.svelte";
  import FileItem from "./FileItem.svelte";

  let {
    vertex,
    onEnter,
  }: {
    vertex: Vertex;
    onEnter: (folder: Vertex) => void;
  } = $props();

  function isFolder(v: Vertex): boolean {
    return v.getProperty("mimeType") === undefined;
  }
</script>

{#if isFolder(vertex)}
  <FolderItem {vertex} {onEnter} />
{:else}
  <FileItem {vertex} />
{/if}

