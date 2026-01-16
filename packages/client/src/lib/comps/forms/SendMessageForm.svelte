<script lang="ts">
  import {
    Send,
    StopCircle,
    Plus,
    Image as ImageIcon,
    FolderOpen,
  } from "lucide-svelte";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import AppConfigDropdown from "@sila/client/comps/apps/AppConfigDropdown.svelte";
  import AttachmentPreviewItem from "./AttachmentPreviewItem.svelte";
  import { onDestroy, onMount, tick } from "svelte";
  import { focusTrap } from "@sila/client/utils/focusTrap";
  import { type MessageFormStatus } from "./messageFormStatus";
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  import type { ChatAppData } from "@sila/core";
  import type { AttachmentPreview } from "@sila/core";
  import type { AppConfig } from "@sila/core";
  import type { Vertex } from "@sila/core";
  import {
    processFileForUpload,
    optimizeImageSize,
    toDataUrl,
    getImageDimensions,
    processTextFileForUpload,
    optimizeTextFile,
    readFileAsText,
    extractTextFileMetadata,
    type TextFileMetadata,
  } from "@sila/client/utils/fileProcessing";
  import ChatEditor from "@sila/client/comps/apps/chat/ChatEditor.svelte";
  import type { FileMention } from "../apps/chat/chatMentionPlugin";
  const clientState = useClientState();

  // Using shared AttachmentPreview type from core

  interface SendMessageFormProps {
    onSend: (msg: string, attachments?: AttachmentPreview[]) => void;
    onStop?: () => void;
    isFocused?: boolean;
    placeholder?: string;
    status?: MessageFormStatus;
    disabled?: boolean;
    draftId?: string;
    attachEnabled?: boolean;
    data?: ChatAppData;
    showConfigSelector?: boolean;
    onConfigChange?: (configId: string) => void;
    configId?: string;
  }

  let {
    onSend,
    onStop = () => {},
    isFocused = true,
    placeholder: externalPlaceholder = undefined,
    status = "can-send-message",
    disabled = false,
    draftId,
    attachEnabled = true,
    data = undefined,
    showConfigSelector = true,
    onConfigChange = undefined,
    configId: externalConfigId = undefined,
  }: SendMessageFormProps = $props();

  let placeholder = $derived(externalPlaceholder ?? i18n.texts.messageForm.placeholder);

  function openModelProvidersSettings() {
    clientState.layout.swins.open(
      swinsLayout.modelProviders.key,
      {},
      i18n.texts.settingsPage.providers.title
    );
  }

  let query = $state("");
  let isEditorFocused = $state(false);
  let isSending = $state(false);
  let attachmentsMenuOpen = $state(false);
  let fileInputEl: HTMLInputElement | null = $state(null);
  type ChatEditorRef = {
    insertFileMentionAtCursor: (file: FileMention) => void;
  };
  let editorRef: ChatEditorRef | null = $state(null);
  type AttachmentWithLoading = AttachmentPreview & { isLoading?: boolean };
  let attachments = $state<AttachmentWithLoading[]>([]);
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

  function persistDraftContent(text: string) {
    if (!draftId) return;
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      clientState.currentSpaceState?.saveDraft(draftId, trimmed);
    } else {
      clientState.currentSpaceState?.deleteDraft(draftId);
    }
  }

  function setEditorContent(text: string) {
    query = text;
  }

  async function searchFileMentions(query: string): Promise<FileMention[]> {
    const chatFilesRoot = data?.getFilesRoot(false);
    if (!clientState.currentSpaceState?.fileResolver) {
      return [];
    }
    return clientState.currentSpaceState?.fileResolver.searchFileMentions(
      query,
      chatFilesRoot
    );
  }

  let canSendMessage = $derived(
    !disabled &&
      status === "can-send-message" &&
      (query.trim().length > 0 || attachments.length > 0)
  );

  let configId = $state("");
  let visibleAppConfigs = $state<AppConfig[]>([]);

  function handleConfigChange(id: string) {
    if (data) {
      data.configId = id;
    }
    // Notify parent component about config change
    onConfigChange?.(id);
  }

  let hasMultipleAssistants = $derived(visibleAppConfigs.length > 1);

  onMount(() => {
    if (data && data.configId) {
      configId = data.configId;
    } else if (externalConfigId) {
      configId = externalConfigId;
    }

    const observeData = data?.observe((d) => {
      const configIdFromData = d.configId;
      if (configIdFromData !== configId) {
        configId = configIdFromData as string;
      }
    });

    // Observe app configs to determine if dropdown should be shown
    const unobserveAppConfigs = clientState.currentSpace?.appConfigs.observe((configs) => {
      visibleAppConfigs = configs.filter((config) => config.visible);
    });

    return () => {
      observeData?.();
      unobserveAppConfigs?.();
    };
  });

  // React to external configId changes when no data is provided
  $effect(() => {
    if (!data && externalConfigId && externalConfigId !== configId) {
      configId = externalConfigId;
    }
  });

  onMount(async () => {
    await loadDraft();
  });

  async function loadDraft() {
    if (!draftId) {
      return;
    }

    const draftContent = await clientState.currentSpaceState?.getDraft(draftId);
    if (draftContent) {
      setEditorContent(draftContent);
    }
  }

  async function onFilesSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    const selected = Array.from(files);

    for (const file of selected) {
      const processingId = crypto.randomUUID();
      const isText =
        file.type.startsWith("text/") ||
        file.name.match(
          /\.(txt|md|json|csv|js|ts|py|java|c|cpp|cs|php|rb|go|rs|swift|kt|scala|sh|bat|ps1|yml|yaml|toml|ini|cfg|conf|xml|html|css|log|tsv)$/i
        );

      // Add processing indicator immediately
      attachments = [
        ...attachments,
        {
          id: processingId,
          kind: isText ? "text" : "image",
          name: file.name,
          mimeType: file.type,
          size: file.size,
          isLoading: true,
        },
      ];

      try {
        // Check if it's a text file first
        const isTextFile = await processTextFileForUpload(file)
          .then(() => true)
          .catch(() => false);

        if (isTextFile) {
          // Process text file
          const processedFile = await processTextFileForUpload(file);
          const optimizedFile = await optimizeTextFile(processedFile);

          // Read text content
          const content = await readFileAsText(optimizedFile);
          const metadata = extractTextFileMetadata(optimizedFile, content);

          // Replace processing indicator with completed attachment
          attachments = attachments.map((att: AttachmentWithLoading) =>
            att.id === processingId
              ? {
                  id: processingId,
                  kind: "text",
                  name: optimizedFile.name,
                  mimeType: optimizedFile.type,
                  size: optimizedFile.size,
                  content,
                  metadata,
                  width: metadata.charCount,
                  height: metadata.lineCount,
                  alt: metadata.language,
                  isLoading: false,
                }
              : att
          );
          trackFileAttached({
            fileType: optimizedFile.type || file.type || "text/plain",
            sizeBytes: optimizedFile.size,
            source: "file-picker",
          });
        } else {
          // Process image file
          const processedFile = await processFileForUpload(file);
          const optimizedFile = await optimizeImageSize(processedFile);

          // Only images for now
          if (!optimizedFile.type.startsWith("image/")) {
            // Remove processing indicator for unsupported files
            attachments = attachments.filter((a: AttachmentWithLoading) => a.id !== processingId);
            trackFileAttachFailed({
              fileType: optimizedFile.type || file.type,
              sizeBytes: optimizedFile.size || file.size,
              reason: "unsupported_type",
            });
            continue;
          }

          const dataUrl = await toDataUrl(optimizedFile);
          const dims = await getImageDimensions(dataUrl);

          // Replace processing indicator with completed attachment
          attachments = attachments.map((att: AttachmentWithLoading) =>
            att.id === processingId
              ? {
                  id: processingId,
                  kind: "image",
                  name: optimizedFile.name,
                  mimeType: optimizedFile.type,
                  size: optimizedFile.size,
                  dataUrl,
                  width: dims?.width,
                  height: dims?.height,
                  isLoading: false,
                }
              : att
          );
          trackFileAttached({
            fileType: optimizedFile.type || file.type,
            sizeBytes: optimizedFile.size,
            source: "file-picker",
          });
        }
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        // Remove processing indicator on error
        attachments = attachments.filter((a: AttachmentWithLoading) => a.id !== processingId);
        trackFileAttachFailed({
          fileType: file.type,
          sizeBytes: file.size,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    // reset input to allow re-selecting the same file
    if (fileInputEl) fileInputEl.value = "";
    attachmentsMenuOpen = false;
  }

  function removeAttachment(id: string) {
    attachments = attachments.filter((a: AttachmentWithLoading) => a.id !== id);
  }

  function openFilePicker() {
    fileInputEl?.click();
  }

  function handleWorkspaceFilePick(files: Vertex[]) {
    const resolver = clientState.currentSpaceState?.fileResolver;
    if (!resolver) return;

    for (const file of files) {
      let path: string;
      try {
        path = resolver.vertexToPath(file);
      } catch (error) {
        console.error("Failed to resolve workspace file path", error);
        continue;
      }

      const name =
        file.name ??
        (file.getProperty("name") as string) ??
        i18n.texts.filesApp.untitledLabel;
      const fileMention: FileMention = { path, name };
      editorRef?.insertFileMentionAtCursor(fileMention);
    }
  }

  function openWorkspaceFilePicker() {
    attachmentsMenuOpen = false;
    clientState.layout.swins.open(
      swinsLayout.filePicker.key,
      { onPick: handleWorkspaceFilePick },
      i18n.texts.filePicker.workspaceFilesTitle
    );
  }

  async function sendMsg() {
    if (disabled || status !== "can-send-message") {
      return;
    }

    onSend(
      query,
      attachments.filter((att: AttachmentWithLoading) => !att.isLoading)
    );
    isSending = true;
    // ensure any open mention UI is closed
    setEditorContent("");

    // Clear draft when message is sent
    if (draftId) {
      await clientState.currentSpaceState?.deleteDraft(draftId);
    }

    // Clear in-memory attachments after sending
    attachments = [];

    isSending = false; // Reset flag after sending is complete
  }

  async function stopMsg() {
    if (status !== "ai-message-in-progress") {
      return;
    }

    onStop();
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
  }

  async function handlePaste(e: ClipboardEvent) {
    if (!attachEnabled || disabled) {
      return;
    }

    const clipboardData = e.clipboardData;
    if (!clipboardData) {
      return;
    }

    // Debug: log all clipboard types

    // Check for any file-related content immediately and prevent default
    const files = Array.from(clipboardData.files || []);
    const imageTypes = clipboardData.types.filter((type) =>
      type.startsWith("image/")
    );
    const hasFileRelatedData = clipboardData.types.some(
      (type) =>
        type === "text/uri-list" ||
        type === "Files" ||
        type.includes("file") ||
        type.includes("Files")
    );

    if (files.length > 0 || imageTypes.length > 0 || hasFileRelatedData) {
      e.preventDefault();
    }

    let hasProcessedContent = false;

    // Check for files in clipboard
    if (files.length > 0) {
      hasProcessedContent = true;

      for (const file of files) {
        const processingId = crypto.randomUUID();
        const isText =
          file.type.startsWith("text/") ||
          file.name.match(
            /\.(txt|md|json|csv|js|ts|py|java|c|cpp|cs|php|rb|go|rs|swift|kt|scala|sh|bat|ps1|yml|yaml|toml|ini|cfg|conf|xml|html|css|log|tsv)$/i
          );

        // Add processing indicator immediately
        attachments = [
          ...attachments,
          {
            id: processingId,
            kind: isText ? "text" : "image",
            name: file.name,
            mimeType: file.type,
            size: file.size,
            isLoading: true,
          },
        ];

        try {
          // Check if it's a text file first
          const isTextFile = await processTextFileForUpload(file)
            .then(() => true)
            .catch(() => false);

          if (isTextFile) {
            // Process text file
            const processedFile = await processTextFileForUpload(file);
            const optimizedFile = await optimizeTextFile(processedFile);

            // Read text content
            const content = await readFileAsText(optimizedFile);
            const metadata = extractTextFileMetadata(optimizedFile, content);

            // Replace processing indicator with completed attachment
            attachments = attachments.map((att: AttachmentWithLoading) =>
              att.id === processingId
                ? {
                    id: processingId,
                    kind: "text",
                    name: optimizedFile.name,
                    mimeType: optimizedFile.type,
                    size: optimizedFile.size,
                    content,
                    metadata,
                    width: metadata.charCount,
                    height: metadata.lineCount,
                    alt: metadata.language,
                    isLoading: false,
                  }
                : att
            );
            trackFileAttached({
              fileType: optimizedFile.type || file.type || "text/plain",
              sizeBytes: optimizedFile.size,
              source: "paste",
            });
          } else {
            // Process image file
            const processedFile = await processFileForUpload(file);
            const optimizedFile = await optimizeImageSize(processedFile);

            // Only images for now
            if (!optimizedFile.type.startsWith("image/")) {
              // Remove processing indicator for unsupported files
              attachments = attachments.filter((a: AttachmentWithLoading) => a.id !== processingId);
              trackFileAttachFailed({
                fileType: optimizedFile.type || file.type,
                sizeBytes: optimizedFile.size || file.size,
                reason: "unsupported_type",
              });
              continue;
            }

            const dataUrl = await toDataUrl(optimizedFile);
            const dims = await getImageDimensions(dataUrl);

            // Replace processing indicator with completed attachment
            attachments = attachments.map((att: AttachmentWithLoading) =>
              att.id === processingId
                ? {
                    id: processingId,
                    kind: "image",
                    name: optimizedFile.name,
                    mimeType: optimizedFile.type,
                    size: optimizedFile.size,
                    dataUrl,
                    width: dims?.width,
                    height: dims?.height,
                    isLoading: false,
                  }
                : att
            );
            trackFileAttached({
              fileType: optimizedFile.type || file.type,
              sizeBytes: optimizedFile.size,
              source: "paste",
            });
          }
        } catch (error) {
          console.error(`Failed to process pasted file ${file.name}:`, error);
          // Remove processing indicator on error
          attachments = attachments.filter((a: AttachmentWithLoading) => a.id !== processingId);
          trackFileAttachFailed({
            fileType: file.type,
            sizeBytes: file.size,
            reason: error instanceof Error ? error.message : "unknown_error",
          });
        }
      }
    }

    // Check for images in clipboard (e.g., screenshots)
    if (imageTypes.length > 0) {
      // Prevent default immediately when images are detected
      e.preventDefault();
      hasProcessedContent = true;
    }

    for (const imageType of imageTypes) {
      let processingId: string | undefined;
      try {
        const dataUrl = clipboardData.getData(imageType);
        if (dataUrl && dataUrl.startsWith("data:")) {
          hasProcessedContent = true;

          processingId = crypto.randomUUID();

          // Add processing indicator immediately
          attachments = [
            ...attachments,
            {
              id: processingId,
              kind: "image",
              name: `pasted-image-${Date.now()}.${imageType.split("/")[1] || "png"}`,
              mimeType: imageType,
              size: 0,
              isLoading: true,
            },
          ];

          // Convert data URL to blob
          const response = await fetch(dataUrl);
          const blob = await response.blob();

          // Convert blob to file
          const file = new File(
            [blob],
            `pasted-image-${Date.now()}.${imageType.split("/")[1] || "png"}`,
            {
              type: imageType,
              lastModified: Date.now(),
            }
          );

          // Process image file
          const processedFile = await processFileForUpload(file);
          const optimizedFile = await optimizeImageSize(processedFile);

          const optimizedDataUrl = await toDataUrl(optimizedFile);
          const dims = await getImageDimensions(optimizedDataUrl);

          // Replace processing indicator with completed attachment
          attachments = attachments.map((att: AttachmentWithLoading) =>
            att.id === processingId
              ? {
                  id: processingId,
                  kind: "image",
                  name: optimizedFile.name,
                  mimeType: optimizedFile.type,
                  size: optimizedFile.size,
                  dataUrl: optimizedDataUrl,
                  width: dims?.width,
                  height: dims?.height,
                  isLoading: false,
                }
              : att
          );
          trackFileAttached({
            fileType: optimizedFile.type || imageType,
            sizeBytes: optimizedFile.size,
            source: "paste",
          });
        }
      } catch (error) {
        console.error(`Failed to process pasted image ${imageType}:`, error);
        // Remove processing indicator on error
        if (processingId) {
          attachments = attachments.filter((a: AttachmentWithLoading) => a.id !== processingId);
        }
        trackFileAttachFailed({
          fileType: imageType,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    // Check for other clipboard types that might contain filenames
    if (hasFileRelatedData) {
      e.preventDefault();
      hasProcessedContent = true;
    }

    // Prevent default paste behavior if we detected any files or images
    // This prevents filenames from being added to the textarea
    if (hasProcessedContent) {
      e.preventDefault();
    }
  }
</script>

{#if clientState.currentSpaceState?.hasModelProviders}
  <form
    data-component="send-message-form"
    class="w-full"
    use:focusTrap={isFocused}
    onsubmit={handleSubmit}
  >
    <div class="relative flex w-full items-center">
      <div
        class="flex w-full flex-col rounded-lg bg-surface-50-950 ring-surface-300-700 transition-colors ring"
      >
        <!-- Attachments previews (in-memory) -->
        {#if attachments.length > 0}
          <div class="flex flex-wrap gap-2 p-4">
            {#each attachments as att: AttachmentWithLoading (att.id)}
              <AttachmentPreviewItem
                attachment={att}
                onRemove={removeAttachment}
              />
            {/each}
          </div>
        {/if}

        <div class="chat-editor-area relative">
          <ChatEditor
            value={query}
            {placeholder}
            autofocus={isFocused}
            bind:this={editorRef}
            onFocusChange={(focused: boolean) => {
              isEditorFocused = focused;
            }}
            onChange={(text: string) => {
              const prev = query;
              query = text;
              if (prev !== text) {
                persistDraftContent(text);
              }
            }}
            onSubmit={sendMsg}
            onEscape={() => {
              clientState.requestClose();
            }}
            getFileMentions={searchFileMentions}
            onPaste={handlePaste}
          />
        </div>

        <!-- Bottom toolbar -->
        <div class="flex items-center justify-between p-2 pt-0 text-sm">
          <div class="flex items-center gap-2">
            {#if showConfigSelector && hasMultipleAssistants}
              <AppConfigDropdown
                {configId}
                onChange={handleConfigChange}
                highlighted={isEditorFocused}
              />
            {/if}

            {#if attachEnabled}
              <ContextMenu
                open={attachmentsMenuOpen}
                onOpenChange={(e: { open: boolean }) =>
                  (attachmentsMenuOpen = e.open)}
                placement="top"
                maxWidth="280px"
              >
                {#snippet trigger()}
                  <button
                    class="flex items-center justify-center h-9 w-9 transition-colors"
                    aria-label={i18n.texts.attachments.addAttachmentsAria}
                    {disabled}
                  >
                    <Plus size={20} />
                  </button>
                {/snippet}
                {#snippet content()}
                  <div class="space-y-2">
                    <button
                      class="flex items-center gap-2 w-full text-left hover:bg-surface-300-700/30 rounded px-2 py-1"
                      onclick={openFilePicker}
                    >
                      <ImageIcon size={18} />
                      <span>{i18n.texts.attachments.uploadPhotosFiles}</span>
                    </button>
                    <button
                      class="flex items-center gap-2 w-full text-left hover:bg-surface-300-700/30 rounded px-2 py-1"
                      onclick={openWorkspaceFilePicker}
                    >
                      <FolderOpen size={18} />
                      <span>{i18n.texts.attachments.browseWorkspaceFiles}</span>
                    </button>
                    <!--
                    <div
                      class="text-xs opacity-60 px-2 py-1 border-t border-surface-300-700/30"
                    >
                      💡 You can also paste files directly into the text area
                    </div>
                    -->
                  </div>
                {/snippet}
              </ContextMenu>
              <input
                type="file"
                accept="image/*,.txt,.md,.json,.csv,.js,.ts,.py,.java,.c,.cpp,.h,.cs,.php,.rb,.go,.rs,.swift,.kt,.scala,.sh,.bat,.ps1,.yml,.yaml,.toml,.ini,.cfg,.conf,.xml,.html,.css,.log,.tsv"
                multiple
                class="hidden"
                bind:this={fileInputEl}
                onchange={onFilesSelected}
              />
            {/if}
          </div>
          <div class="flex items-center gap-2">
            {#if status === "ai-message-in-progress"}
              <button
                onclick={stopMsg}
                class="flex items-center justify-center h-9 w-9 transition-colors"
                aria-label={i18n.texts.messageForm.stop}
              >
                <StopCircle size={20} />
              </button>
            {:else}
              <button
                onclick={sendMsg}
                class="flex items-center justify-center h-9 w-9 transition-colors"
                class:opacity-50={!canSendMessage}
                disabled={!canSendMessage}
                aria-label={i18n.texts.messageForm.send}
              >
                <Send size={20} />
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </form>
{:else}
  <div
    class="relative flex w-full flex-col items-center justify-center rounded-lg bg-surface-50-950 p-4 transition-colors ring ring-surface-300-700"
  >
    <p class="mb-4 text-center">{i18n.texts.attachments.setupProviderMessage}</p>
    <button class="btn preset-filled" onclick={openModelProvidersSettings}>
      {i18n.texts.attachments.setupBrainsButton}
    </button>
  </div>
{/if}

<style>
  :global(.chat-file-mention) {
    display: inline;
    padding: 0 0.2rem;
    border-radius: 0.4rem;
    background: color-mix(in oklab, var(--anchor-font-color) 16%, transparent);
    color: var(--anchor-font-color);
    font-size: inherit;
    line-height: inherit;
    font-weight: inherit;
    vertical-align: baseline;
  }

  :global(.dark .chat-file-mention) {
    background: color-mix(in oklab, var(--anchor-font-color-dark) 18%, transparent);
    color: var(--anchor-font-color-dark);
  }
</style>
