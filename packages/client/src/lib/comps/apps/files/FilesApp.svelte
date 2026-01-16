<script lang="ts">
  import { onMount } from "svelte";
  import { FilesTreeData, type AttachmentPreview, type Vertex } from "@sila/core";
  import { Upload, FolderPlus } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import {
    processFileForUpload,
    processTextFileForUpload,
    optimizeImageSize,
    optimizeTextFile,
    toDataUrl,
    getImageDimensions,
    isTextFile,
    readFileAsText,
    extractTextFileMetadata,
  } from "@sila/client/utils/fileProcessing";
  import FolderView from "./FolderView.svelte";
  import FileFolderBreadcrumbs from "./FileFolderBreadcrumbs.svelte";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  const {
    filesRoot,
    onFileOpen,
    onSelectionChange,
  }: {
    filesRoot: Vertex;
    onFileOpen?: (file: Vertex) => void;
    onSelectionChange?: (files: Vertex[]) => void;
  } = $props();

  let currentFolder = $state<Vertex | undefined>(undefined);
  let items = $state<Vertex[]>([]);
  let selectIdForArea: string | undefined = $state(undefined);
  let renameIdForArea: string | undefined = $state(undefined);

  let unobserveCurrent: (() => void) | undefined;

  // Upload state
  let isDragOver = $state(false);
  let isUploading = $state(false);
  let fileInputEl: HTMLInputElement | null = $state(null);
  function bytesToMb(bytes?: number): number | undefined {
    if (typeof bytes !== "number" || Number.isNaN(bytes)) return undefined;
    return Math.round((bytes / (1024 * 1024)) * 100) / 100;
  }

  function trackFileAttached(params: {
    fileType?: string;
    sizeBytes?: number;
    source?: string;
  }) {
    const file_type = params.fileType || "unknown";
    clientState.currentSpaceState?.spaceTelemetry.fileAttached({
      file_type,
      size_mb: bytesToMb(params.sizeBytes),
      source: params.source,
    });
  }

  function trackFileAttachFailed(params: {
    fileType?: string;
    sizeBytes?: number;
    reason?: string;
  }) {
    clientState.currentSpaceState?.spaceTelemetry.fileAttachFailed({
      file_type: params.fileType,
      size_mb: bytesToMb(params.sizeBytes),
      reason: params.reason,
    });
  }

  onMount(() => {
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

    await uploadFiles(Array.from(files), "files-app-picker");

    // Reset input to allow re-selecting the same file
    if (fileInputEl) fileInputEl.value = "";
  }

  async function uploadFiles(fileList: File[], source: "files-app-picker" | "files-app-drop") {
    if (isUploading || !currentFolder) return;

    isUploading = true;

    try {
      const store = clientState.currentSpace?.fileStore;
      if (!store) {
        console.error("File store not available");
        trackFileAttachFailed({ reason: "file_store_missing" });
        return;
      }

      for (const file of fileList) {
        try {
          // Detect if this is a text file first
          const textLike = await isTextFile(file).catch(() => false);

          if (textLike) {
            // Text files: store as mutable UUID-backed documents
            const processedText = await processTextFileForUpload(file);
            const optimizedText = await optimizeTextFile(processedText);
            const content = await readFileAsText(optimizedText);
            const metadata = extractTextFileMetadata(optimizedText, content);

            const uuid = crypto.randomUUID();
            const textBytes = new TextEncoder().encode(content);
            await store.putMutable(uuid, textBytes);

            const preview: AttachmentPreview = {
              id: uuid,
              kind: "text",
              name: optimizedText.name,
              mimeType: optimizedText.type || "text/plain",
              size: content.length,
              content,
              metadata,
              width: metadata.charCount,
              height: metadata.lineCount,
              alt: metadata.language,
            };

            FilesTreeData.saveFileInfoFromAttachment(
              currentFolder,
              preview,
              uuid
            );
            trackFileAttached({
              fileType: optimizedText.type || file.type || "text/plain",
              sizeBytes: optimizedText.size,
              source,
            });
          } else {
            // Images and other non-text files: store in immutable CAS via data URL
            const processedFile = await processFileForUpload(file);
            const optimizedFile = await optimizeImageSize(processedFile);
            const dataUrl = await toDataUrl(optimizedFile);

            const put = await store.putDataUrl(dataUrl);

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
                  originalDimensions = `${originalDims.width}x${originalDims.width}`;
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

            FilesTreeData.saveFileInfoFromAttachment(
              currentFolder,
              preview,
              put.hash
            );
            trackFileAttached({
              fileType: optimizedFile.type || file.type,
              sizeBytes: optimizedFile.size,
              source,
            });
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          trackFileAttachFailed({
            fileType: file.type,
            sizeBytes: file.size,
            reason: error instanceof Error ? error.message : "unknown_error",
          });
        }
      }
    } catch (error) {
      console.error("Upload failed:", error);
      trackFileAttachFailed({
        reason: error instanceof Error ? error.message : "unknown_error",
      });
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
      uploadFiles(Array.from(files), "files-app-drop");
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
        <p class="text-muted-foreground">
          {i18n.texts.filesApp.filesRootNotFound}
        </p>
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
                  {i18n.texts.filesApp.uploading}
                {:else}
                  <Upload size={16} />
                  {i18n.texts.filesApp.uploadFiles}
                {/if}
              </button>
              <button
                class="btn btn-sm preset-outline flex items-center gap-2"
                onclick={createNewFolder}
                type="button"
              >
                <FolderPlus size={16} />
                {i18n.texts.filesApp.newFolder}
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
          {onFileOpen}
          {onSelectionChange}
        />
        {#if items.length === 0}
          <p class="text-muted-foreground">
            {i18n.texts.filesApp.emptyFolderPrefix}
            <button class="anchor cursor-pointer" onclick={openFilePicker}>
              {i18n.texts.filesApp.emptyFolderUpload}
            </button>
            {i18n.texts.filesApp.emptyFolderOr}
            <span class="href">{i18n.texts.filesApp.emptyFolderMove}</span>
            {i18n.texts.filesApp.emptyFolderSuffix}
          </p>
        {/if}
      {/if}
    </div>
  </div>
</div>
