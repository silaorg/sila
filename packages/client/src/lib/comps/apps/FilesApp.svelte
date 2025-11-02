<script lang="ts">
  import { onMount } from "svelte";
  import { FilesAppData } from "@sila/core";
  import type { AttachmentPreview } from "@sila/core";
  import type { Vertex } from "@sila/core";
  import { Upload, FolderPlus } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { processFileForUpload, optimizeImageSize, toDataUrl, getImageDimensions } from "@sila/client/utils/fileProcessing";
  import FileOrFolder from "./FileOrFolder.svelte";
  const clientState = useClientState();

  let { data }: { data: FilesAppData } = $props();

  let filesRoot = $state<Vertex | undefined>(undefined);
  let currentFolder = $state<Vertex | undefined>(undefined);
  let path = $state<Vertex[]>([]);

  let items = $state<Vertex[]>([]);

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
    items = [];

    if (!currentFolder) {
      return;
    }

    // Use the natural order from currentFolder.children (will add custom sorting later)
    items = [...currentFolder.children];
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

  // Upload functions
  function openFilePicker() {
    fileInputEl?.click();
  }

  function createNewFolder() {
    if (!currentFolder) return;
    
    /*
    const folderName = prompt("Enter folder name:");
    if (!folderName || !folderName.trim()) return;
    const trimmedName = folderName.trim();
    */
    const trimmedName = "new folder";
    
    // Check if a folder with this name already exists
    const existing = currentFolder.children.find((c) => {
      const mimeType = c.getProperty("mimeType");
      return mimeType === undefined && c.name === trimmedName;
    });
    
    // Create new folder vertex (folders don't have mimeType)
    currentFolder.newNamedChild(trimmedName, {
      createdAt: Date.now()
    });
    
    // The observation will automatically refresh the lists
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
    class="flex-grow overflow-y-auto pt-2 cursor-default"
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
        <!-- Breadcrumbs and buttons row -->
        <div class="flex items-center justify-between mb-4">
          <!-- Breadcrumbs -->
          <div class="flex flex-wrap items-center gap-1.5 text-lg font-medium">
            {#each path as crumb, i (crumb.id)}
              {#if i > 0}
                <span class="opacity-50">/</span>
              {/if}
              <button
                class="px-1.5 py-1 rounded hover:bg-surface-500/10 transition-colors"
                onclick={() => goToCrumb(i)}
                type="button"
              >
                {displayName(crumb) || (i === 0 ? "Files" : "Unnamed")}
              </button>
            {/each}
          </div>
          
          <!-- Action buttons -->
          {#if currentFolder}
            <div class="flex items-center gap-2">
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
                  <Upload size={16} />
                  Upload Files
                {/if}
              </button>
              <button
                class="btn btn-sm preset-outline flex items-center gap-2"
                onclick={createNewFolder}
                type="button"
              >
                <FolderPlus size={16} />
                New Folder
              </button>
            </div>
          {/if}
        </div>

        <!-- Files and Folders -->
        {#if items.length > 0}
          <div class="flex flex-wrap gap-3">
            {#each items as item (item.id)}
              <FileOrFolder
                vertex={item}
                onEnter={enterFolder}
                treeId={((data as any).appTree?.getId()) || ""}
              />
            {/each}
          </div>
        {:else}
          <p class="text-muted-foreground">This folder is empty.</p>
        {/if}
      {/if}
    </div>
  </div>
</div>
