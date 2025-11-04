<script lang="ts">
  import type { Vertex } from "@sila/core";

  let {
    folder,
    root,
    onEnter,
  }: {
    folder: Vertex;
    root?: Vertex;
    onEnter: (folder: Vertex) => void;
  } = $props();

  const path = $derived.by(() => {
    let crumbs: Vertex[] = [];
    let current = folder;
    while (current) {
      crumbs.unshift(current);

      // Stop when we reached the target root: include it, but don't go past it
      if (current.id === root?.id) break;

      if (!current.parent) break;

      current = current.parent;
    }

    return crumbs;
  });

  const currentFolderName = $derived.by(() => {
    if (folder.id === root?.id) return "Workspace";
    return folder.name ?? "Unnamed";
  });

  function goToCrumb(index: number) {
    onEnter(path[index]);
  }
</script>

<div class="flex flex-wrap items-center gap-1.5 text-lg font-medium">
  {#each path as crumb, i (crumb.id)}
    {#if i > 0}
      <span class="opacity-50">/</span>
    {/if}
    <button
      class="px-1.5 py-1 rounded hover:bg-surface-500/10 transition-colors"
      data-vertex-id={crumb.id}
      onclick={() => goToCrumb(i)}
      type="button"
    >
      {#if i === 0}
        Assets
      {:else}
        {crumb.name ?? "Unnamed"}
      {/if}
    </button>
  {/each}
</div>
