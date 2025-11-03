<script lang="ts">
  import type { Vertex } from "@sila/core";
  import FolderItem from "./FolderItem.svelte";
  import FileItem from "./FileItem.svelte";

  let {
    vertex,
    onEnter,
    selected = false,
  }: {
    vertex: Vertex;
    onEnter: (folder: Vertex) => void;
    selected?: boolean;
  } = $props();

  function isFolder(v: Vertex): boolean {
    return v.getProperty("mimeType") === undefined;
  }
</script>

{#if isFolder(vertex)}
  <FolderItem {vertex} {onEnter} selected={selected} />
{:else}
  <FileItem {vertex} selected={selected} />
{/if}

