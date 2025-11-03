<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { Folder } from "lucide-svelte";

  let {
    vertex,
    onEnter,
    selected = false,
  }: {
    vertex: Vertex;
    onEnter: (folder: Vertex) => void;
    selected?: boolean;
  } = $props();

  const name = $derived(vertex.name ?? "Untitled");
</script>

<button
  class="flex flex-col items-center p-3 hover:bg-surface-500/5 rounded-lg transition-colors w-32"
  class:ring-2={selected}
  class:ring-primary-500={selected}
  ondblclick={() => onEnter(vertex)}
  type="button"
>
  <div class="mb-2 flex items-center justify-center w-20 h-20">
    <Folder size={64} class="text-blue-500" />
  </div>
  <span class="text-xs text-center truncate w-full">{name}</span>
</button>

