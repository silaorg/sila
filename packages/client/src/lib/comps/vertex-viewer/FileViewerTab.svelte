<script lang="ts">
  import type { ResolvedFileInfo, Vertex } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { getFilePreviewConfig } from "@sila/client/utils/filePreview";
  import FileView from "./FileView.svelte";
  import { i18n } from "@sila/client";

  let {
    treeId,
    vertexId,
  }: {
    treeId: string;
    vertexId: string;
  } = $props();

  const clientState = useClientState();

  let resolvedFile = $state<ResolvedFileInfo | null>(null);
  let isLoading = $state(false);
  let loadError = $state<string | null>(null);

  let previewConfig = $derived.by(() => {
    if (!resolvedFile?.mimeType) return null;
    return getFilePreviewConfig(resolvedFile.mimeType);
  });

  let shouldUseDocLayout = $derived.by(() => {
    const previewType = previewConfig?.previewType;
    return previewType === "text" || previewType === "code";
  });

  $effect(() => {
    treeId;
    vertexId;

    const spaceState = clientState.currentSpaceState;
    const space = clientState.currentSpace;

    if (!spaceState || !space) {
      resolvedFile = null;
      loadError = i18n.texts.files.failedToLoad;
      isLoading = false;
      return;
    }

    let isActive = true;
    isLoading = true;
    loadError = null;

    const loadVertex = async (): Promise<Vertex> => {
      if (treeId === space.getId()) {
        const vertex = space.getVertex(vertexId);
        if (!vertex) {
          throw new Error(`File vertex not found: ${vertexId}`);
        }
        return vertex;
      }

      const appTree = await space.loadAppTree(treeId);
      if (!appTree) {
        throw new Error(`Files tree not found: ${treeId}`);
      }

      const vertex = appTree.tree.getVertex(vertexId);
      if (!vertex) {
        throw new Error(`File vertex not found: ${vertexId}`);
      }

      return vertex;
    };

    loadVertex()
      .then((vertex) => {
        if (!isActive) return;
        const resolved = spaceState.fileResolver.resolveVertexToFileReference(
          vertex
        );
        if (!resolved) {
          loadError = i18n.texts.files.failedToLoad;
          resolvedFile = null;
          return;
        }
        resolvedFile = resolved;
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("Failed to load file for tab:", error);
        loadError = i18n.texts.files.failedToLoad;
        resolvedFile = null;
      })
      .finally(() => {
        if (!isActive) return;
        isLoading = false;
      });

    return () => {
      isActive = false;
    };
  });

</script>

<div class="flex h-full w-full flex-col">
  <div
    class="flex-1 overflow-auto"
  >
    {#if isLoading}
      <div class="text-sm">{i18n.texts.fileViewer.loading}</div>
    {:else if loadError}
      <div class="text-sm">{loadError}</div>
    {:else if resolvedFile}
      {#if shouldUseDocLayout}
        <div class="w-full flex justify-center">
          <div
            class="w-full max-w-4xl bg-surface-50-950"
          >
            <FileView file={resolvedFile} />
          </div>
        </div>
      {:else}
        <FileView file={resolvedFile} />
      {/if}
    {:else}
      <div class="text-sm">{i18n.texts.files.noFileData}</div>
    {/if}
  </div>
</div>
