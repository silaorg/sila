<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { File as FileIcon } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  let {
    vertex,
  }: {
    vertex: Vertex;
  } = $props();

  const clientState = useClientState();

  function displayName(v: Vertex): string {
    const folderName = v.name;
    if (folderName && folderName !== "file") {
      return folderName;
    }
    return v.name ?? "";
  }

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
      return (window as any).electronFileSystem.getFileUrl(spaceId, hash, mimeType, name);
    }
    
    // Fallback to empty string if electron API not available
    return "";
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
</script>

<div class="flex flex-col items-center p-3 hover:bg-surface-500/5 rounded-lg transition-colors w-32">
  <div class="mb-2 flex items-center justify-center w-20 h-20">
    {#if isImageFile(vertex)}
      <!-- Image preview -->
      <img 
        src={getFileUrl(vertex)} 
        alt={displayName(vertex)}
        class="w-full h-full object-cover rounded"
        loading="lazy"
      />
    {:else}
      <!-- File icon -->
      <FileIcon size={64} class="text-muted-foreground" />
    {/if}
  </div>
  <span class="text-xs text-center truncate w-full mb-1">{displayName(vertex) || "Untitled"}</span>
  {#if vertex.getProperty("size")}
    <span class="text-xs text-muted-foreground">{formatSize(vertex.getProperty("size") as number)}</span>
  {/if}
</div>

