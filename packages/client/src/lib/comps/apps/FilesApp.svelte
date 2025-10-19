<script lang="ts">
  import { onMount } from "svelte";
  import { FilesAppData } from "@sila/core";
  import type { AttachmentPreview } from "@sila/core";
  import type { Vertex } from "@sila/core";
  import { Folder, File as FileIcon, Upload, Plus } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { processFileForUpload, optimizeImageSize, toDataUrl, getImageDimensions } from "@sila/client/utils/fileProcessing";
  const clientState = useClientState();

  let { data }: { data: FilesAppData } = $props();

  let filesRoot = $state<Vertex | undefined>(undefined);
  let currentFolder = $state<Vertex | undefined>(undefined);
  let path = $state<Vertex[]>([]);

  let children = $state<Vertex[]>([]);
  let folders = $state<Vertex[]>([]);
  let files = $state<Vertex[]>([]);

  let unobserveCurrent: (() => void) | undefined;
  
  // Upload state
  let isDragOver = $state(false);
  let isUploading = $state(false);
  let fileInputEl: HTMLInputElement | null = $state(null);

  onMount(() => {
    filesRoot = data.filesVertex;
    if (!filesRoot) return;
    path = [filesRoot];
    currentFolder = filesRoot;
    refreshLists();
    observeCurrentFolder();
  });

  function refreshLists() {
    if (!currentFolder) {
      children = [];
      folders = [];
      files = [];
      return;
    }

    children = currentFolder.children;
    folders = children.filter((v) => {
      const n = v.name;
      return n && n !== "file";
    });
    files = children.filter((v) => v.name === "file");
  }

  function observeCurrentFolder() {
    unobserveCurrent?.();
    if (!currentFolder) return;
    unobserveCurrent = currentFolder.observe((events) => {
      if (events.some((e) => e.type === "children" || e.type === "property")) {
        refreshLists();
      }
    });
  }

  function enterFolder(folder: Vertex) {
    path = [...path, folder];
    currentFolder = folder;
    refreshLists();
    observeCurrentFolder();
  }

  function goToCrumb(index: number) {
    if (index < 0 || index >= path.length) return;
    path = path.slice(0, index + 1);
    currentFolder = path[path.length - 1];
    refreshLists();
    observeCurrentFolder();
  }

  $effect(() => {
    return () => {
      unobserveCurrent?.();
    };
  });

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
    
    // Get space ID from the space object, not the app tree
    const spaceId = (data as any).space.getId();
    
    // Use the electron file system API if available
    if ((window as any).electronFileSystem) {
      return (window as any).electronFileSystem.getFileUrl(spaceId, hash, mimeType, name);
    }
    
    // Fallback to data URL if electron API not available
    return "";
  }

  // Upload functions
  function openFilePicker() {
    fileInputEl?.click();
  }

  async function onFilesSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    
    await uploadFiles(Array.from(files));
    
    // Reset input to allow re-selecting the same file
    if (fileInputEl) fileInputEl.value = "";
  }

  async function uploadFiles(fileList: File[]) {
    if (isUploading || !currentFolder) return;
    
    isUploading = true;
    
    try {
      const store = (data as any).space.getFileStore();
      if (!store) {
        console.error("File store not available");
        return;
      }

      const filesTree = await FilesAppData.getOrCreateDefaultFilesTree((data as any).space);
      
      for (const file of fileList) {
        try {
          // Step 1: Process file (convert HEIC if needed)
          const processedFile = await processFileForUpload(file);
          
          // Step 2: Resize image if needed (2048x2048 max)
          const optimizedFile = await optimizeImageSize(processedFile);
          
          // Step 3: Convert to data URL
          const dataUrl = await toDataUrl(optimizedFile);
          
          // Step 4: Upload to CAS (deduplication happens here)
          const put = await store.putDataUrl(dataUrl);
          
          // Step 5: Build an AttachmentPreview for simplified API usage
          let originalDimensions: string | undefined;
          let width: number | undefined;
          let height: number | undefined;
          if (optimizedFile.type.startsWith('image/')) {
            const dims = await getImageDimensions(dataUrl);
            width = dims?.width;
            height = dims?.height;
            if (processedFile !== file || optimizedFile !== processedFile) {
              const originalDims = await getImageDimensions(await toDataUrl(file));
              if (originalDims) {
                originalDimensions = `${originalDims.width}x${originalDims.height}`;
              }
            }
          }

          const preview: AttachmentPreview = {
            id: crypto.randomUUID(),
            kind: 'image',
            name: optimizedFile.name,
            mimeType: optimizedFile.type,
            size: optimizedFile.size,
            dataUrl,
            width,
            height,
          };

          // Step 6: Create/link file using the simplified API with attachment
          const { FilesTreeData } = await import("@sila/core");
          FilesTreeData.saveFileInfoFromAttachment(
            currentFolder,
            preview,
            put.hash
          );
          
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      isUploading = false;
    }
  }



  // Drag and drop handlers
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      uploadFiles(Array.from(files));
    }
  }
</script>

<div class="flex flex-col w-full h-full overflow-hidden">
  <div 
    class="flex-grow overflow-y-auto pt-2"
    class:bg-blue-50={isDragOver}
    class:border-2={isDragOver}
    class:border-dashed={isDragOver}
    class:border-blue-500={isDragOver}
    role="button"
    tabindex="0"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    <div class="w-full max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-2">
        <h2 class="h2">Files</h2>
        {#if currentFolder}
          <button
            class="btn btn-sm preset-outline flex items-center gap-2"
            onclick={openFilePicker}
            disabled={isUploading}
            type="button"
          >
            {#if isUploading}
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
              Uploading...
            {:else}
              <Plus size={16} />
              Upload Files
            {/if}
          </button>
        {/if}
      </div>
      
      <!-- Hidden file input -->
      <input 
        type="file" 
        multiple 
        class="hidden" 
        bind:this={fileInputEl} 
        onchange={onFilesSelected} 
      />

      {#if !filesRoot}
        <p class="text-muted-foreground">Files root not found.</p>
      {:else}
        <!-- Breadcrumbs -->
        <div class="flex flex-wrap items-center gap-1 text-sm mb-4">
          {#each path as crumb, i (crumb.id)}
            {#if i > 0}
              <span class="opacity-50">/</span>
            {/if}
            <button
              class="px-1 py-0.5 rounded hover:bg-surface-500/10"
              onclick={() => goToCrumb(i)}
              type="button"
            >
              {displayName(crumb) || (i === 0 ? "Files" : "Unnamed")}
            </button>
          {/each}
        </div>

        <!-- Folders -->
        {#if folders.length > 0}
          <div class="mb-3">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each folders as folder (folder.id)}
                <button
                  class="border rounded-lg p-3 text-left hover:bg-surface-500/5"
                  onclick={() => enterFolder(folder)}
                  type="button"
                >
                  <div class="flex items-center gap-2">
                    <Folder size={16} />
                    <span class="text-sm font-medium">{displayName(folder) || "Untitled folder"}</span>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Files -->
        {#if files.length > 0}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {#each files as file (file.id)}
              <div class="border rounded-lg p-3">
                {#if isImageFile(file)}
                  <!-- Image preview -->
                  <div class="mb-2">
                    <img 
                      src={getFileUrl(file)} 
                      alt={displayName(file)}
                      class="w-full h-32 object-cover rounded border"
                      loading="lazy"
                    />
                  </div>
                {/if}
                <div class="flex items-center gap-2 mb-1">
                  <FileIcon size={16} />
                  <span class="text-sm font-medium">{displayName(file) || "Untitled"}</span>
                </div>
                <div class="text-xs text-muted-foreground space-y-0.5">
                  <div>Type: {file.getProperty("mimeType") || "Unknown"}</div>
                  {#if file.getProperty("size")}
                    <div>Size: {file.getProperty("size")} bytes</div>
                  {/if}
                  {#if file.getProperty("width") && file.getProperty("height")}
                    <div>Dimensions: {file.getProperty("width")} × {file.getProperty("height")}</div>
                  {/if}
                  {#if file.getProperty("originalFormat")}
                    <div class="text-blue-600">Converted from: {file.getProperty("originalFormat")}</div>
                    {#if file.getProperty("originalFilename")}
                      <div class="text-blue-600">Original: {file.getProperty("originalFilename")}</div>
                    {/if}
                  {/if}
                  {#if file.getProperty("originalDimensions")}
                    <div class="text-blue-600">Original dimensions: {file.getProperty("originalDimensions")}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if folders.length === 0 && files.length === 0}
          <p class="text-muted-foreground">This folder is empty.</p>
        {/if}
      {/if}
    </div>
  </div>
</div>
