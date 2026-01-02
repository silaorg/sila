<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { File, Folder } from "lucide-svelte";
  import { i18n } from "@sila/client";

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
  <div class="min-w-[200px] max-w-[360px]">
    <div class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-medium shadow-md">
      {totalCount}
    </div>
    <div class="mt-1 pl-4 flex flex-col gap-1">
      {#each topItems as item (item.id)}
        <div class="flex items-center gap-2 text-sm truncate opacity-50">
          {#if isFolder(item)}
            <Folder size={16} class="text-neutral-700" />
          {:else}
            <File size={16} class="text-neutral-700" />
          {/if}
          <span class="truncate">{item.name}</span>
        </div>
      {/each}
      {#if items.length > topItems.length}
        <div class="text-[11px] text-neutral-600 opacity-50">
          {i18n.texts.filesApp.moreItems(items.length - topItems.length)}
        </div>
      {/if}
    </div>
  </div>
</div>

