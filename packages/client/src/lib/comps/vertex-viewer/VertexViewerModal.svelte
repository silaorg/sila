<script lang="ts">
  import { closeStack } from "@sila/client/utils/closeStack";
  import { FILE_PREVIEW_CONFIGS } from "@sila/client/utils/filePreview";
  import type { ResolvedFileInfo } from "@sila/core";
  import { X, Download, File } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import FileView from "./FileView.svelte";
  import { i18n } from "@sila/client";

  const clientState = useClientState();
  const vertexViewer = $derived(clientState.currentSpaceState?.vertexViewer);
  const activeVertex = $derived(vertexViewer?.activeVertex);

  const activeFile: ResolvedFileInfo | null = $derived.by(() => {
    if (!activeVertex) return null;

    const spaceState = clientState.currentSpaceState;
    if (!spaceState) return null;

    return spaceState.fileResolver.resolveVertexToFileReference(activeVertex);
  });

  function handleBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      vertexViewer?.close();
    }
  }

  function getDownloadFilename(): string {
    if (!activeFile) return "file";
    const name = activeFile.name;
    const ext = name.split(".").pop();

    // If filename already has an extension, use it as is
    if (ext && ext !== name) {
      return name;
    }

    // Otherwise, try to infer extension from mimeType
    if (activeFile.mimeType) {
      const config = FILE_PREVIEW_CONFIGS[activeFile.mimeType];
      if (config && config.supportedFormats.length > 0) {
        return `${name}.${config.supportedFormats[0]}`;
      }
    }

    return name;
  }

  async function handleDownload() {
    if (!activeFile) return;

    try {
      // Fetch the file as a blob
      const response = await fetch(activeFile.url);
      if (!response.ok) {
        console.error("Failed to fetch file for download");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = getDownloadFilename();
      link.click();

      // Clean up the object URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Download failed:", error);
    }
  }
</script>

{#if activeVertex}
  <div
    class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-default"
    onclick={handleBackdropClick}
    use:closeStack={() => {
      // @TODO: consider to make it more explicit and making sure that it gets to the top of the
      // stack when the modal opens
      vertexViewer?.close();
      return true;
    }}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        handleBackdropClick(e);
      }
    }}
    tabindex="0"
    role="button"
    aria-label={i18n.texts.actions.close}
  >
    <!-- Close button -->
    <button
      class="absolute top-4 right-4 btn-icon bg-black/50 text-white hover:bg-black/70 z-10"
      onclick={() => vertexViewer?.close()}
    >
      <X size={20} />
    </button>

    {#if activeFile}
      <!-- Download button -->
      <button
        class="absolute top-16 right-4 btn-icon bg-black/50 text-white hover:bg-black/70 z-10"
        onclick={handleDownload}
      >
        <Download size={20} />
      </button>
    {/if}

    <!-- Content -->
    <div
      class="relative max-w-full max-h-full p-8"
    >
      {#if activeFile}
        <FileView file={activeFile} />
      {:else}
        <div class="bg-white text-black p-8 rounded text-center max-w-md">
          <div class="text-6xl mb-4"><File size={20} /></div>
          <h3 class="text-xl font-medium mb-2">{activeVertex.name}</h3>
        </div>
      {/if}
    </div>
  </div>
{/if}
