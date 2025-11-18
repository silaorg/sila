<script lang="ts">
  import type { Snippet } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { Vertex } from "@sila/core";

  const clientState = useClientState();
  let { path, title, relativeRootVertex, children }: { path: string; title: string; relativeRootVertex?: Vertex; children: Snippet } = $props();

  function openFile() {
    const vertex = clientState.pathToVertex(path, relativeRootVertex);
    clientState.currentSpaceState?.vertexViewer.openVertex(vertex);
  }
</script>

<button class="inline-flex items-center gap-1 p-1 rounded bg-primary-300-700 text-xs" title={title} onclick={openFile}>
  {@render children()}
</button>