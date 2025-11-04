<script lang="ts">
  import type { Vertex } from "@sila/core";
  import FolderItem from "./FolderItem.svelte";
  import FileItem from "./FileItem.svelte";

  let {
    vertex,
    onEnter,
    selected = false,
    renaming = false,
    onRename,
    onCancelRename,
    dropTarget = false,
  }: {
    vertex: Vertex;
    onEnter: (folder: Vertex) => void;
    selected?: boolean;
    renaming?: boolean;
    onRename?: (newName: string) => void;
    onCancelRename?: () => void;
    dropTarget?: boolean;
  } = $props();

  function isFolder(v: Vertex): boolean {
    return v.getProperty("mimeType") === undefined;
  }
</script>

{#if isFolder(vertex)}
  <FolderItem {vertex} {onEnter} selected={selected} renaming={renaming} onRename={onRename} onCancelRename={onCancelRename} dropTarget={dropTarget} />
{:else}
  <FileItem {vertex} selected={selected} renaming={renaming} onRename={onRename} onCancelRename={onCancelRename} dropTarget={dropTarget} />
{/if}

