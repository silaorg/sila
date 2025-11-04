<script lang="ts">
  import { onMount } from "svelte";
  import { FilesAppData } from "@sila/core";
  import type { AttachmentPreview } from "@sila/core";
  import type { Vertex } from "@sila/core";
  import { Upload, FolderPlus } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import {
    processFileForUpload,
    optimizeImageSize,
    toDataUrl,
    getImageDimensions,
  } from "@sila/client/utils/fileProcessing";
  import FolderView from "./FolderView.svelte";
  import FileFolderBreadcrumbs from "./FileFolderBreadcrumbs.svelte";
  const clientState = useClientState();

  let { data }: { data: FilesAppData } = $props();

  let filesRoot = $derived<Vertex | undefined>(undefined);
  let currentFolder = $state<Vertex | undefined>(undefined);
  let items = $state<Vertex[]>([]);
  let selectIdForArea: string | undefined = $state(undefined);
  let renameIdForArea: string | undefined = $state(undefined);

  let unobserveCurrent: (() => void) | undefined;

  // Upload state
  let isDragOver = $state(false);
  let isUploading = $state(false);
  let fileInputEl: HTMLInputElement | null = $state(null);

  onMount(() => {
    filesRoot = data.filesVertex;
    if (!filesRoot) return;
    currentFolder = filesRoot;
    refreshItems();
  });

  function refreshItems() {
    items = [];

    if (!currentFolder) {
      return;
    }

    // Use the natural order from currentFolder.children (will add custom sorting later)
    items = [...currentFolder.children];
  }

  /*
  function observeCurrentFolder() {
    unobserveCurrent?.();
    if (!currentFolder) return;
    unobserveCurrent = currentFolder.observe((events) => {
      if (events.some((e) => e.type === "children" || e.type === "property")) {
        refreshLists();
      }
    });
  }
  */

  function enterFolder(folder: Vertex) {
    currentFolder = folder;
    refreshItems();
    //observeCurrentFolder();
  }

  function goBack() {
    if (!currentFolder || !filesRoot) return;
    if (currentFolder.id === filesRoot.id) return;
    const parent = currentFolder.parent;
    if (parent) {
      currentFolder = parent;
      refreshItems();
    }
  }

  $effect(() => {
    unobserveCurrent?.();
    if (!currentFolder) return;
    unobserveCurrent = currentFolder.observe((events) => {
      if (events.some((e) => e.type === "children" || e.type === "property")) {
        refreshItems();
      }
    });
  });

  $effect(() => {
    return () => {
      unobserveCurrent?.();
    };
  });

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
    const v = currentFolder.newNamedChild(trimmedName, {
      createdAt: Date.now(),
    });

    // Select and start renaming the newly created folder
    selectIdForArea = v.id;
    renameIdForArea = v.id;

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
          if (optimizedFile.type.startsWith("image/")) {
            const dims = await getImageDimensions(dataUrl);
            width = dims?.width;
            height = dims?.height;
            if (processedFile !== file || optimizedFile !== processedFile) {
              const originalDims = await getImageDimensions(
                await toDataUrl(file)
              );
              if (originalDims) {
                originalDimensions = `${originalDims.width}x${originalDims.height}`;
              }
            }
          }

          const preview: AttachmentPreview = {
            id: crypto.randomUUID(),
            kind: "image",
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
    <div class="w-full max-w-4xl mx-auto p-1">
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
          {#if currentFolder}
            <FileFolderBreadcrumbs
              folder={currentFolder}
              root={filesRoot}
              onEnter={enterFolder}
            />

            <!-- Action buttons -->
            <div class="flex items-center gap-2">
              <button
                class="btn btn-sm preset-outline flex items-center gap-2"
                onclick={openFilePicker}
                disabled={isUploading}
                type="button"
              >
                {#if isUploading}
                  <div
                    class="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"
                  ></div>
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
        <FolderView
          {items}
          onEnter={enterFolder}
          onBack={goBack}
          selectId={selectIdForArea}
          renameId={renameIdForArea}
        />
        {#if items.length === 0}
          <p class="text-muted-foreground">
            You can <button
              class="anchor cursor-pointer"
              onclick={openFilePicker}>upload</button
            >
            or <span class="href">move</span> files in this folder.
          </p>
        {/if}
      {/if}
    </div>
  </div>
</div>
