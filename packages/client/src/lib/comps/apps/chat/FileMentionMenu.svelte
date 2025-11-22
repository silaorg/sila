<script lang="ts">
  import { onMount } from "svelte";
  import {
    computePosition,
    offset as fuiOffset,
    flip,
    shift,
  } from "@floating-ui/dom";
  import type { FileMention } from "./chatMentionPlugin";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { useChatAppDataOptional } from "./chatAppContext";
  import type { ResolvedFileInfo } from "@sila/core";
  import { getFilePreviewConfig } from "@sila/client/utils/filePreview";
  import RegularFilePreview from "@sila/client/comps/files/RegularFilePreview.svelte";

  interface FileMentionMenuProps {
    files: FileMention[];
    selectedIndex: number;
    coords: { x: number; y: number };
    onFilePick: (file: FileMention, event?: MouseEvent) => void;
    onClose: () => void;
  }

  let {
    files,
    selectedIndex,
    coords,
    onFilePick,
    onClose,
  }: FileMentionMenuProps = $props();

  const clientState = useClientState();
  const chatAppData = useChatAppDataOptional();
  const fileResolver = $derived(clientState.currentSpaceState?.fileResolver);
  const filesVertex = $derived(chatAppData?.getFilesRoot(false));

  let menuEl: HTMLDivElement | null = $state(null);
  let selectedFile: ResolvedFileInfo | null = $state(null);
  let isLoadingPreview = $state(false);
  let previewError = $state<string | null>(null);

  const selectedFileMention = $derived(
    files[selectedIndex] ?? null
  );

  const previewConfig = $derived.by(() => {
    if (!selectedFile?.mimeType) return null;
    return getFilePreviewConfig(selectedFile.mimeType);
  });

  // Resolve the selected file for preview
  $effect(() => {
    if (!selectedFileMention || !fileResolver) {
      selectedFile = null;
      isLoadingPreview = false;
      previewError = null;
      return;
    }

    async function resolveFile() {
      isLoadingPreview = true;
      previewError = null;
      try {
        const vertex = fileResolver.pathToVertex(
          selectedFileMention.path,
          filesVertex ?? undefined
        );
        if (!vertex) {
          previewError = "File not found";
          selectedFile = null;
          return;
        }

        const resolved = fileResolver.resolveVertexToFileReference(vertex);
        if (resolved) {
          selectedFile = resolved;
        } else {
          previewError = "Failed to resolve file";
          selectedFile = null;
        }
      } catch (error) {
        console.error("Failed to resolve file for preview:", error);
        previewError = error instanceof Error ? error.message : "Unknown error";
        selectedFile = null;
      } finally {
        isLoadingPreview = false;
      }
    }

    resolveFile();
  });

  async function updatePosition() {
    if (!menuEl) return;

    const virtualReference = {
      getBoundingClientRect() {
        const x = coords.x;
        const y = coords.y;
        return {
          x,
          y,
          left: x,
          right: x,
          top: y,
          bottom: y,
          width: 0,
          height: 0,
        } as DOMRect;
      },
    };

    const { x, y } = await computePosition(
      virtualReference as any,
      menuEl,
      {
        placement: "bottom-start",
        strategy: "fixed",
        middleware: [fuiOffset(4), flip(), shift({ padding: 8 })],
      }
    );

    Object.assign(menuEl.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  }

  function handleMenuClick(event: MouseEvent) {
    event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  onMount(() => {
    requestAnimationFrame(() => {
      void updatePosition();
    });
  });

  $effect(() => {
    if (menuEl && coords) {
      void updatePosition();
    }
  });
</script>

<div
  bind:this={menuEl}
  class="card fixed z-20 flex rounded-md text-sm context-menu card bg-surface-50-950 border border-surface-100-900 shadow-lg"
  role="menu"
  tabindex="-1"
  onclick={handleMenuClick}
  onmousedown={(e) => e.stopPropagation()}
  onkeydown={handleKeyDown}
>
  <!-- File list -->
  <div class="min-w-[240px] p-2 border-r border-surface-100-900">
    <p class="mb-2 text-xs font-semibold uppercase tracking-wide">
      Mention a file
    </p>
    <div class="flex flex-col gap-1">
      {#each files as file, index}
        <button
          type="button"
          class="flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-surface-100-900"
          class:bg-surface-100-900={index === selectedIndex}
          onmousedown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFilePick(file, e);
          }}
        >
          <span class="truncate">{file.name}</span>
        </button>
      {/each}
      {#if files.length === 0}
        <div class="px-2 py-1 text-xs opacity-60">No files found</div>
      {/if}
    </div>
  </div>

  <!-- Preview panel -->
  {#if selectedFileMention}
    <div class="w-[280px] p-3 border-l border-surface-100-900">
      {#if isLoadingPreview}
        <div
          class="flex items-center justify-center h-32 bg-surface-100-900 rounded animate-pulse"
        >
          <span class="text-xs text-surface-500-500-token">Loading...</span>
        </div>
      {:else if previewError}
        <div
          class="flex items-center justify-center h-32 bg-surface-100-900 rounded text-red-500 text-xs"
        >
          {previewError}
        </div>
      {:else if selectedFile && previewConfig}
        {#if previewConfig.previewType === "image"}
          <div class="flex items-center justify-center bg-surface-100-900 rounded p-2 min-h-[200px]">
            <img
              src={selectedFile.url}
              alt={selectedFile.name}
              class="max-w-full max-h-[200px] object-contain rounded"
              loading="lazy"
            />
          </div>
        {:else}
          <RegularFilePreview fileInfo={selectedFile} />
        {/if}
      {:else if selectedFile}
        <RegularFilePreview fileInfo={selectedFile} />
      {:else}
        <div
          class="flex items-center justify-center h-32 bg-surface-100-900 rounded text-xs opacity-60"
        >
          No preview available
        </div>
      {/if}
    </div>
  {/if}
</div>

