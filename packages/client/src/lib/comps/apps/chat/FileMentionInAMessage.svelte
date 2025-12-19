<script lang="ts">
  import type { Snippet } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { parseFrefUri, Vertex } from "@sila/core";

  const clientState = useClientState();
  let { path, title, relativeRootVertex, children }: { path: string; title: string; relativeRootVertex?: Vertex; children: Snippet } = $props();

  async function openFile() {
    if (!clientState.currentSpaceState?.fileResolver) {
      return;
    }

    const space = clientState.currentSpace;
    let vertex: Vertex | undefined;

    try {
      if (path.startsWith("fref:")) {
        if (!space) return;
        const parsed = parseFrefUri(path);
        if (!parsed) return;
        if (parsed.treeId) {
          if (parsed.treeId === space.getId()) {
            vertex = space.getVertex(parsed.vertexId);
          } else {
            const appTree = await space.loadAppTree(parsed.treeId);
            vertex = appTree?.tree.getVertex(parsed.vertexId) as Vertex | undefined;
          }
        } else {
          // Best-effort search: current chat tree (if relativeRootVertex provided) is typically first,
          // then workspace. This keeps the UI working even for legacy `fref:vertex` refs.
          // If it’s ambiguous, first match wins.
          vertex = space.getVertex(parsed.vertexId);
          if (!vertex) {
            const treeIds = space.getAppTreeIds();
            for (const tid of treeIds) {
              const appTree = await space.loadAppTree(tid);
              const v = appTree?.tree.getVertex(parsed.vertexId) as Vertex | undefined;
              if (v) {
                vertex = v;
                break;
              }
            }
          }
        }
      } else {
        vertex = clientState.currentSpaceState?.fileResolver.pathToVertex(
          path,
          relativeRootVertex,
        );
      }
    } catch {
      return;
    }

    if (!vertex) return;

    clientState.currentSpaceState?.vertexViewer.openVertex(vertex);
  }
</script>

<button class="inline-flex items-center gap-1 p-1 rounded bg-primary-300-700 text-xs" title={title} onclick={openFile}>
  {@render children()}
</button>