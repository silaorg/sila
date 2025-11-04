<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { Folder } from "lucide-svelte";

  let {
    vertex,
    onEnter,
    selected = false,
    renaming = false,
    onRename,
    onCancelRename,
  }: {
    vertex: Vertex;
    onEnter: (folder: Vertex) => void;
    selected?: boolean;
    renaming?: boolean;
    onRename?: (newName: string) => void;
    onCancelRename?: () => void;
  } = $props();

  const name = $derived(vertex.name ?? "Untitled");
  let editName = $state("");
  let inputEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (renaming) {
      editName = name;
      // Focus and select all text after mount
      queueMicrotask(() => {
        inputEl?.focus();
        inputEl?.select();
      });
    }
  });
</script>

<button
  class="flex flex-col items-center p-3 hover:bg-surface-100-900 rounded-lg w-32 select-none"
  class:bg-surface-100-900={selected}
  ondblclick={() => onEnter(vertex)}
  type="button"
  tabindex="-1"
>
  <div class="mb-2 flex items-center justify-center w-20 h-20">
    <Folder size={64} class="text-blue-500" />
  </div>
  {#if renaming}
    <input
      class="w-full text-xs text-center p-0 m-0 bg-transparent border border-transparent focus:border-transparent focus:outline-none focus:ring-0 select-text"
      bind:this={inputEl}
      bind:value={editName}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const trimmed = editName.trim();
          if (trimmed) onRename?.(trimmed);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancelRename?.();
        }
      }}
      onblur={() => onCancelRename?.()}
    />
  {:else}
    <span class="text-xs text-center truncate w-full">{name}</span>
  {/if}
</button>

