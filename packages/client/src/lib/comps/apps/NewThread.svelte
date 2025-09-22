<script lang="ts">
  import SendMessageForm from "../../comps/forms/SendMessageForm.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { ChatAppData } from "@sila/core";
  const clientState = useClientState();
  import type { AppConfig } from "@sila/core";
  import { onMount } from "svelte";
  import type { AttachmentPreview } from "@sila/core";

  let { appConfig, onSend }: { appConfig?: AppConfig; onSend?: () => void } =
    $props();
  let targetAppConfig: AppConfig | undefined = $state(undefined);

  onMount(() => {
    if (!appConfig) {
      targetAppConfig = clientState.currentSpace?.getAppConfigs()[0];
    } else {
      targetAppConfig = appConfig;
    }
  });

  const placeholder = "Write a message...";

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
    const chatAppData = new ChatAppData(clientState.currentSpace, newTree);
    
    // Pass attachments to newMessage and wait for it to complete
    await chatAppData.newMessage("user", message, undefined, attachments);

    const layout = clientState.currentSpaceState?.layout;
    if (layout) {
      layout.openChatTab(newTree.tree.root!.id, "New chat");
    }

    onSend?.();
  }
</script>

<div class="space-y-4 max-w-screen-md min-w-[600px]">
  {#if targetAppConfig}
    <h3 class="h3">{targetAppConfig.name}</h3>
    <p>{targetAppConfig.description}</p>
    <SendMessageForm
      onSend={handleSend}
      onConfigChange={handleConfigChange}
      {placeholder}
      draftId="new-thread"
      showConfigSelector={true}
      configId={targetAppConfig?.id}
    />
  {/if}
</div>
