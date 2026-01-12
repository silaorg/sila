<script lang="ts">
  import type { Snippet } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { Vertex } from "@sila/core";

  const clientState = useClientState();
  let { path, title, relativeRootVertex, children }: { path: string; title: string; relativeRootVertex?: Vertex; children: Snippet } = $props();

  function openFile() {
    if (!clientState.currentSpaceState?.fileResolver) {
      return;
    }

    let vertex: Vertex | undefined;
    try {
      vertex = clientState.currentSpaceState?.fileResolver.pathToVertex(
        path,
        relativeRootVertex,
      );
    } catch {
      return;
    }

    if (!vertex) return;

    clientState.currentSpaceState?.vertexViewer.openVertex(vertex);
  }
</script>

<button class="chat-file-mention anchor" title={title} onclick={openFile}>
  {@render children()}
</button>
