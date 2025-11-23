<script lang="ts">
  import type { ThreadMessage } from "@sila/core";
  import type { ChatAppData } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import type { VisibleMessage } from "./chatTypes";
  import ChatAppMessageByUser from "./ChatAppMessageByUser.svelte";
  import ChatAppMessageByAssistant from "./ChatAppMessageByAssistant.svelte";
  import ChatAppMessageByError from "./ChatAppMessageByError.svelte";

  let {
    visibleMessage,
    data,
    isLastMessage = false,
    lastProcessMessagesExpanded = false,
    onLastProcessMessagesExpandedChange,
  }: { 
    visibleMessage: VisibleMessage; 
    data: ChatAppData; 
    isLastMessage?: boolean;
    lastProcessMessagesExpanded?: boolean;
    onLastProcessMessagesExpandedChange?: (expanded: boolean) => void;
  } = $props();

  const vertex = $derived(visibleMessage.vertex);
  let message: ThreadMessage | undefined = $state(undefined);
  let configName = $state<string | undefined>(undefined);

  // Update local message when vertex changes
  $effect(() => {
    if (vertex) {
      message = vertex.getAsTypedObject<ThreadMessage>();
    } else {
      message = undefined;
    }
  });

  // Effect to update config name if config still exists
  $effect(() => {
    if (!vertex) {
      configName = data.configAppConfig?.name || undefined;
    } else if (message?.role === "assistant") {
      const configId = vertex.getProperty("configId") as string;
      if (configId && clientState.currentSpace) {
        const config = clientState.currentSpace.getAppConfig(configId);
        if (config) {
          configName = config.name;
          return;
        }
      }
      if (message?.id) {
        configName = data.getMessageProperty(message.id, "configName");
      }
    }
  });
</script>

{#if !vertex}
  <ChatAppMessageByAssistant 
    {visibleMessage} 
    {data} 
    {isLastMessage}
    {lastProcessMessagesExpanded}
    {onLastProcessMessagesExpandedChange}
  />
{:else if message?.role === "user"}
  <ChatAppMessageByUser {visibleMessage} {data} />
{:else if message?.role === "assistant"}
  <ChatAppMessageByAssistant 
    {visibleMessage} 
    {data} 
    {isLastMessage}
    {lastProcessMessagesExpanded}
    {onLastProcessMessagesExpandedChange}
  />
{:else if message?.role === "error"}
  <ChatAppMessageByError {visibleMessage} {data} />
{:else}
  <!-- Fallback: if no vertex yet, render assistant shell to show processing/acting -->
  <ChatAppMessageByAssistant 
    {visibleMessage} 
    {data} 
    {isLastMessage}
    {lastProcessMessagesExpanded}
    {onLastProcessMessagesExpandedChange}
  />
{/if}
