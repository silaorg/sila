<script lang="ts">
  import { writable } from "svelte/store";
  import type { RepTree } from "@sila/core";
  import TreeBlockViz from "./TreeBlockViz.svelte";

  export let tree: RepTree;

  const treeStores = {
    dragStartVertexIdStore: writable<string | undefined>(undefined),
    dragOverVertexIdStore: writable<string | null | undefined>(undefined),
  }
</script>

<div style="margin-bottom: 20px;">
  <TreeBlockViz {tree} vertexId={tree.root!.id} {treeStores} />
</div>
