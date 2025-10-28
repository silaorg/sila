<script lang="ts">
  import { Sparkles, LoaderCircle } from "lucide-svelte";
  import type { ThreadMessage } from "@sila/core";
  import type { ChatAppData } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import type { VisibleMessage } from "./chatTypes";
  import ChatAppProcessMessages from "./ChatAppProcessMessages.svelte";
  import ChatAppMessageByUser from "./ChatAppMessageByUser.svelte";
  import ChatAppMessageByAssistant from "./ChatAppMessageByAssistant.svelte";
  import ChatAppMessageByError from "./ChatAppMessageByError.svelte";

  let {
    visibleMessage,
    data,
  }: { visibleMessage: VisibleMessage; data: ChatAppData } = $props();

  const vertex = $derived(visibleMessage.vertex);
  let message: ThreadMessage | undefined = $state(undefined);
  let configName = $state<string | undefined>(undefined);
  let isProcessMessagesExpanded = $state(false);

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
  <div class="flex gap-3 px-4 py-2">
    <div class="flex-shrink-0 mt-1">
      <div class="w-8 h-8 rounded-full flex items-center justify-center">
        <Sparkles size={18} />
      </div>
    </div>
    <div class="min-w-0 max-w-[85%]">
      <div class="flex gap-2 mt-2">
        <span class="font-bold cursor-default">{configName || "AI"} </span>
        {#if visibleMessage.progressVertices.length > 0}
          <span class="opacity-70">•</span>
          <button
            class="flex items-center gap-1 group"
            onclick={() =>
              (isProcessMessagesExpanded = !isProcessMessagesExpanded)}
          >
            <LoaderCircle size={12} class="animate-spin" /><span
              class="text-shimmer">Processing</span
            >
          </button>
        {/if}
      </div>

      <div>
        {#if visibleMessage.progressVertices.length > 0 && isProcessMessagesExpanded}
          <ChatAppProcessMessages vertices={visibleMessage.progressVertices} />
        {/if}
      </div>
    </div>
  </div>
{:else if message?.role === "user"}
  <ChatAppMessageByUser {visibleMessage} {data} />
{:else if message?.role === "assistant"}
  <ChatAppMessageByAssistant {visibleMessage} {data} />
{:else if message?.role === "error"}
  <ChatAppMessageByError {visibleMessage} {data} />
{/if}
