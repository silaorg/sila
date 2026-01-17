<script lang="ts">
  import SendMessageForm from "../../comps/forms/SendMessageForm.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { ChatAppData } from "@sila/core";
  const clientState = useClientState();
  import type { AppConfig } from "@sila/core";
  import { onMount } from "svelte";
  import type { AttachmentPreview } from "@sila/core";
  import { FileUp } from "lucide-svelte";
  import { i18n } from "@sila/client";

  let {
    appConfig,
    onSend,
    targetPanelId
  }: { appConfig?: AppConfig; onSend?: () => void; targetPanelId?: string } =
    $props();
  let targetAppConfig: AppConfig | undefined = $state(undefined);
  let isDraggingFiles = $state(false);
  let dragCounter = 0;
  let sendMessageFormRef = $state<any>(null);

  onMount(() => {
    if (!appConfig) {
      targetAppConfig = clientState.currentSpace?.getAppConfigs()[0];
    } else {
      targetAppConfig = appConfig;
    }
  });

  function handleSend(msg: string, attachments?: AttachmentPreview[]) {
    // Allow sending if there's either text content or attachments
    if (!msg && (!attachments || attachments.length === 0)) {
      return;
    }

    newThread(msg, attachments);
  }

  function handleConfigChange(configId: string) {
    // Update target app config when config changes in SendMessageForm
    const newConfig = clientState.currentSpace?.getAppConfigs().find(config => config.id === configId);
    if (newConfig) {
      targetAppConfig = newConfig;
    }
  }

  async function newThread(message: string = "", attachments?: AttachmentPreview[]) {
    if (!targetAppConfig) {
      throw new Error("App config not found");
    }

    if (!clientState.currentSpace) {
      throw new Error("Space or app config not found");
    }

    // Create new app tree
    const newTree = ChatAppData.createNewChatTree(
      clientState.currentSpace,
      targetAppConfig.id,
    );
    clientState.currentSpaceState?.spaceTelemetry.chatStarted({
      chat_id: newTree.tree.root!.id,
      assistant_id: targetAppConfig.id,
    });
    const chatAppData = new ChatAppData(clientState.currentSpace, newTree);
    
    // Pass attachments to newMessage and wait for it to complete
    await chatAppData.newMessage({ role: "user", text: message, attachments });

    const layout = clientState.currentSpaceState?.layout;
    if (layout) {
      layout.openChatTab(newTree.tree.root!.id, "New chat", targetPanelId);
    }

    onSend?.();
  }

  function dragEventHasFiles(event: DragEvent): boolean {
    if (!event.dataTransfer) return false;
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleDragEnter(e: DragEvent) {
    if (!dragEventHasFiles(e)) return;
    e.preventDefault();
    dragCounter++;
    isDraggingFiles = true;
  }

  function handleDragOver(e: DragEvent) {
    if (!dragEventHasFiles(e)) return;
    e.preventDefault();
  }

  function handleDragLeave(e: DragEvent) {
    if (!dragEventHasFiles(e)) return;
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      isDraggingFiles = false;
      dragCounter = 0;
    }
  }

  function handleDrop(e: DragEvent) {
    if (!dragEventHasFiles(e)) return;
    e.preventDefault();
    dragCounter = 0;
    isDraggingFiles = false;

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      sendMessageFormRef?.handleFiles(e.dataTransfer.files);
    }
  }
</script>

<div
  class="space-y-4 max-w-screen-md min-w-[600px] relative"
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label={i18n.texts.chat.dropFilesAria}
>
  {#if isDraggingFiles}
    <div
      class="absolute inset-0 z-50 flex items-center justify-center bg-surface-50/80 dark:bg-surface-950/80 backdrop-blur-sm pointer-events-none rounded-xl"
    >
      <div
        class="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-primary-500 rounded-xl bg-surface-50 dark:bg-surface-900 shadow-lg animate-pulse"
      >
        <FileUp size={48} class="text-primary-500" />
        <p class="text-xl font-medium text-surface-900 dark:text-surface-50">
          {i18n.texts.chat.dropFilesTitle}
        </p>
      </div>
    </div>
  {/if}
  {#if targetAppConfig}
    <h3 class="h3">{targetAppConfig.name}</h3>
    <p>{targetAppConfig.description}</p>
    <SendMessageForm
      bind:this={sendMessageFormRef}
      onSend={handleSend}
      onConfigChange={handleConfigChange}
      draftId="new-thread"
      showConfigSelector={true}
      configId={targetAppConfig?.id}
    />
  {/if}
</div>
