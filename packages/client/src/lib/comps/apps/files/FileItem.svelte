<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { File as FileIcon } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { i18n } from "@sila/client";

  let {
    vertex,
    selected = false,
    renaming = false,
    onRename,
    onCancelRename,
    dropTarget = false,
    onOpen,
  }: {
    vertex: Vertex;
    selected?: boolean;
    renaming?: boolean;
    onRename?: (newName: string) => void;
    onCancelRename?: () => void;
    dropTarget?: boolean;
    onOpen?: (file: Vertex) => void;
  } = $props();

  const clientState = useClientState();

  const size = $derived(formatSize(vertex.getProperty("size") as number));
  const name = $derived(vertex.name ?? i18n.texts.filesApp.untitledLabel);
  const fileUrl = $derived(getFileUrl(vertex));
  const isImage = $derived(isImageFile(vertex));
  let editName = $state("");
  let inputEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (renaming) {
      editName = name;
      queueMicrotask(() => {
        inputEl?.focus();
        inputEl?.select();
      });
    }
  });

  function isImageFile(file: Vertex): boolean {
    const mimeType = file.getProperty("mimeType") as string;
    return mimeType?.startsWith("image/") ?? false;
  }

  function getFileUrl(file: Vertex): string {
    const hash = file.getProperty("hash") as string;
    const mimeType = file.getProperty("mimeType") as string;
    const name = file.getProperty("name") as string;

    const spaceId = clientState.currentSpace?.getId();
    if (!spaceId) return "";

    // Use the electron file system API if available
    if ((window as any).electronFileSystem) {
      return (window as any).electronFileSystem.getFileUrl(
        spaceId,
        hash,
        mimeType,
        name
      );
    }

    // Fallback to empty string if electron API not available
    return "";
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  async function openFile() {
    try {
      clientState.currentSpaceState?.vertexViewer.openVertex(vertex);
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  }

</script>

<div
  class="flex flex-col items-center p-3 hover:bg-surface-100-900 rounded-lg w-32 cursor-pointer select-none"
  class:bg-surface-100-900={selected}
  class:outline={dropTarget}
  class:outline-2={dropTarget}
  class:outline-primary-500={dropTarget}
  ondblclick={() => (onOpen ? onOpen(vertex) : openFile())}
  role="button"
  tabindex="-1"
>
  <div class="mb-2 flex items-center justify-center w-20 h-20">
    {#if isImage}
      <!-- Image preview -->
      <img
        src={fileUrl}
        alt={name}
        class="w-full h-full object-cover"
        loading="lazy"
      />
    {:else}
      <!-- File icon -->
      <FileIcon size={64} class="text-muted-foreground" />
    {/if}
  </div>
  {#if renaming}
    <input
      class="w-full mb-1 text-xs text-center p-0 m-0 bg-transparent border border-transparent focus:border-transparent focus:outline-none focus:ring-0"
      bind:this={inputEl}
      bind:value={editName}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const trimmed = editName.trim();
          if (trimmed) onRename?.(trimmed);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancelRename?.();
        }
      }}
      onblur={() => onCancelRename?.()}
    />
  {:else}
    <span class="text-xs text-center truncate w-full mb-1">{name}</span>
  {/if}
  {#if vertex.getProperty("size")}
    <span class="text-xs text-muted-foreground">{size}</span>
  {/if}
</div>
