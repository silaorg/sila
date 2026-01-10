<script lang="ts">
  import type { ResolvedFileInfo, Vertex } from "@sila/core";
  import { Download } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import FileView from "./FileView.svelte";
  import { i18n } from "@sila/client";
  import { FILE_PREVIEW_CONFIGS } from "@sila/client/utils/filePreview";

  let {
    treeId,
    vertexId,
    name,
  }: {
    treeId: string;
    vertexId: string;
    name?: string;
  } = $props();

  const clientState = useClientState();

  let resolvedFile = $state<ResolvedFileInfo | null>(null);
  let isLoading = $state(false);
  let loadError = $state<string | null>(null);

  const displayName = $derived(
    resolvedFile?.name ?? name ?? i18n.texts.filesApp.untitledLabel
  );

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

  function getDownloadFilename(file: ResolvedFileInfo): string {
    const fileName = file.name;
    const ext = fileName.split(".").pop();

    if (ext && ext !== fileName) {
      return fileName;
    }

    if (file.mimeType) {
      const config = FILE_PREVIEW_CONFIGS[file.mimeType];
      if (config && config.supportedFormats.length > 0) {
        return `${fileName}.${config.supportedFormats[0]}`;
      }
    }

    return fileName;
  }

  async function handleDownload() {
    if (!resolvedFile) return;

    try {
      const response = await fetch(resolvedFile.url);
      if (!response.ok) {
        console.error("Failed to fetch file for download");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = getDownloadFilename(resolvedFile);
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Download failed:", error);
    }
  }
</script>

<div class="flex h-full w-full flex-col bg-surface-50-950 text-surface-900-50">
  <div
    class="flex items-center justify-between border-b border-surface-200-800 px-4 py-3"
  >
    <div class="min-w-0">
      <div class="text-sm font-medium truncate">{displayName}</div>
    </div>
    {#if resolvedFile}
      <button
        class="btn-icon"
        onclick={handleDownload}
        aria-label="Download"
        title="Download"
      >
        <Download size={16} />
      </button>
    {/if}
  </div>

  <div class="flex-1 overflow-auto p-4">
    {#if isLoading}
      <div class="text-sm">{i18n.texts.fileViewer.loading}</div>
    {:else if loadError}
      <div class="text-sm">{loadError}</div>
    {:else if resolvedFile}
      <FileView file={resolvedFile} />
    {:else}
      <div class="text-sm">{i18n.texts.files.noFileData}</div>
    {/if}
  </div>
</div>
