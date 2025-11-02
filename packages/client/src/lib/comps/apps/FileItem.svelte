<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { File as FileIcon } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { ClientFileResolver } from "../../utils/fileResolver";

  let {
    vertex,
    treeId,
  }: {
    vertex: Vertex;
    treeId: string;
  } = $props();

  const clientState = useClientState();

  const size = $derived(formatSize(vertex.getProperty("size") as number));
  const name = $derived(vertex.name ?? "Untitled");
  const fileUrl = $derived(getFileUrl(vertex));
  const isImage = $derived(isImageFile(vertex));

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
      const fileRef = {
        tree: treeId,
        vertex: vertex.id,
      };
      const fileInfo = await ClientFileResolver.resolveFileReference(fileRef);
      if (fileInfo) {
        clientState.gallery.open(fileInfo);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  }
</script>

<div
  class="flex flex-col items-center p-3 hover:bg-surface-500/5 rounded-lg transition-colors w-32 cursor-pointer"
  ondblclick={openFile}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === "Enter" && openFile()}
>
  <div class="mb-2 flex items-center justify-center w-20 h-20">
    {#if isImage}
      <!-- Image preview -->
      <img
        src={fileUrl}
        alt={name}
        class="w-full h-full object-cover rounded"
        loading="lazy"
      />
    {:else}
      <!-- File icon -->
      <FileIcon size={64} class="text-muted-foreground" />
    {/if}
  </div>
  <span class="text-xs text-center truncate w-full mb-1">{name}</span>
  {#if vertex.getProperty("size")}
    <span class="text-xs text-muted-foreground">{size}</span>
  {/if}
</div>
