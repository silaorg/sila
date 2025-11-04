<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { File, Folder } from "lucide-svelte";

  let { items = [], x = 0, y = 0 }: { items: Vertex[]; x: number; y: number } = $props();

  function isFolder(v: Vertex): boolean {
    return v.getProperty("mimeType") === undefined;
  }

  let topItems = $derived(items.slice(0, 6));
  let filesCount = $derived(items.filter((i) => !isFolder(i)).length);
  let foldersCount = $derived(items.filter((i) => isFolder(i)).length);
  let totalCount = $derived(items.length);
</script>

<div
  class="fixed z-[9999] pointer-events-none"
  style={`left:${x + 12}px; top:${y + 12}px`}
>
  <div class="rounded-md shadow-lg border border-neutral-200/60 bg-white/95 backdrop-blur px-3 py-2 min-w-[220px] max-w-[360px]">
    <div class="text-xs text-neutral-500 mb-1">
      {#if totalCount === 1}
        1 item
      {:else}
        {totalCount} items
      {/if}
      {#if foldersCount || filesCount}
        · {foldersCount} folder{foldersCount === 1 ? "" : "s"}
        {#if filesCount}
          , {filesCount} file{filesCount === 1 ? "" : "s"}
        {/if}
      {/if}
    </div>

    <div class="flex flex-col gap-1">
      {#each topItems as item (item.id)}
        <div class="flex items-center gap-2 text-sm truncate">
          {#if isFolder(item)}
            <Folder size={16} class="text-neutral-600" />
          {:else}
            <File size={16} class="text-neutral-600" />
          {/if}
          <span class="truncate">{item.name}</span>
        </div>
      {/each}
      {#if items.length > topItems.length}
        <div class="text-[11px] text-neutral-500">+ {items.length - topItems.length} more…</div>
      {/if}
    </div>
  </div>
</div>


