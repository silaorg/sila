<script lang="ts">
  import { Send, StopCircle, Plus, Image as ImageIcon } from "lucide-svelte";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import AppConfigDropdown from "@sila/client/comps/apps/AppConfigDropdown.svelte";
  import AttachmentPreviewItem from "./AttachmentPreviewItem.svelte";
  import { onDestroy, onMount, tick } from "svelte";
  import { focusTrap } from "@sila/client/utils/focusTrap";
  import { type MessageFormStatus } from "./messageFormStatus";
  import { txtStore } from "@sila/client/state/txtStore";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { ChatAppData } from "@sila/core";
  import type { AttachmentPreview } from "@sila/core";
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
    placeholder = $txtStore.messageForm.placeholder,
    status = "can-send-message",
    disabled = false,
    draftId,
    attachEnabled = true,
    data = undefined,
    showConfigSelector = true,
    onConfigChange = undefined,
    configId: externalConfigId = undefined,
  }: SendMessageFormProps = $props();

  function openModelProvidersSettings() {
    clientState.layout.swins.open("model-providers", {}, "Model Providers");
  }

  let query = $state("");
  let isEditorFocused = $state(false);
  let isSending = $state(false);
  let attachmentsMenuOpen = $state(false);
  let fileInputEl: HTMLInputElement | null = $state(null);
  let attachments = $state<(AttachmentPreview & { isLoading?: boolean })[]>([]);
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
    return clientState.searchFileMentions(query, chatFilesRoot);
  }

  let canSendMessage = $derived(
    !disabled &&
      status === "can-send-message" &&
      (query.trim().length > 0 || attachments.length > 0)
  );

  let configId = $state("");

  function handleConfigChange(id: string) {
    if (data) {
      data.configId = id;
    }
    // Notify parent component about config change
    onConfigChange?.(id);
  }

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

    return () => {
      observeData?.();
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
          attachments = attachments.map((att) =>
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
        } else {
          // Process image file
          const processedFile = await processFileForUpload(file);
          const optimizedFile = await optimizeImageSize(processedFile);

          // Only images for now
          if (!optimizedFile.type.startsWith("image/")) {
            // Remove processing indicator for unsupported files
            attachments = attachments.filter((a) => a.id !== processingId);
            continue;
          }

          const dataUrl = await toDataUrl(optimizedFile);
          const dims = await getImageDimensions(dataUrl);

          // Replace processing indicator with completed attachment
          attachments = attachments.map((att) =>
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
        }
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        // Remove processing indicator on error
        attachments = attachments.filter((a) => a.id !== processingId);
      }
    }

    // reset input to allow re-selecting the same file
    if (fileInputEl) fileInputEl.value = "";
    attachmentsMenuOpen = false;
  }

  function removeAttachment(id: string) {
    attachments = attachments.filter((a) => a.id !== id);
  }

  function openFilePicker() {
    fileInputEl?.click();
  }

  async function sendMsg() {
    if (disabled || status !== "can-send-message") {
      return;
    }

    onSend(
      query,
      attachments.filter((att) => !att.isLoading)
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
            attachments = attachments.map((att) =>
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
          } else {
            // Process image file
            const processedFile = await processFileForUpload(file);
            const optimizedFile = await optimizeImageSize(processedFile);

            // Only images for now
            if (!optimizedFile.type.startsWith("image/")) {
              // Remove processing indicator for unsupported files
              attachments = attachments.filter((a) => a.id !== processingId);
              continue;
            }

            const dataUrl = await toDataUrl(optimizedFile);
            const dims = await getImageDimensions(dataUrl);

            // Replace processing indicator with completed attachment
            attachments = attachments.map((att) =>
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
          }
        } catch (error) {
          console.error(`Failed to process pasted file ${file.name}:`, error);
          // Remove processing indicator on error
          attachments = attachments.filter((a) => a.id !== processingId);
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
          attachments = attachments.map((att) =>
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
        }
      } catch (error) {
        console.error(`Failed to process pasted image ${imageType}:`, error);
        // Remove processing indicator on error
        if (processingId) {
          attachments = attachments.filter((a) => a.id !== processingId);
        }
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
            {#each attachments as att (att.id)}
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
            placeholder={placeholder}
            autofocus={isFocused}
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
            {#if showConfigSelector}
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
                    aria-label="Add attachments (or paste files)"
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
                      <span>Upload photos & files</span>
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
                aria-label={$txtStore.messageForm.stop}
              >
                <StopCircle size={20} />
              </button>
            {:else}
              <button
                onclick={sendMsg}
                class="flex items-center justify-center h-9 w-9 transition-colors"
                class:opacity-50={!canSendMessage}
                disabled={!canSendMessage}
                aria-label={$txtStore.messageForm.send}
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
    <p class="mb-4 text-center">Set up a model provider to chat with AI.</p>
    <button class="btn preset-filled" onclick={openModelProvidersSettings}>
      Setup brains
    </button>
  </div>
{/if}

<style>
  :global(.chat-file-mention) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.4rem;
    border-radius: 0.375rem;
    background: rgba(59, 130, 246, 0.16);
    color: rgb(37, 99, 235);
    font-size: 0.85em;
    font-weight: 600;
  }

  :global(.dark .chat-file-mention) {
    background: rgba(96, 165, 250, 0.15);
    color: rgb(191, 219, 254);
  }
</style>
