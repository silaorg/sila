<script lang="ts">
  import SendMessageForm from "../../forms/SendMessageForm.svelte";
  import ChatAppMessage from "./ChatAppMessage.svelte";
  import { onMount, tick } from "svelte";
  import { timeout } from "@sila/core";
  import { ChatAppData } from "@sila/core";
  import type { Vertex } from "@sila/core";
  import type { ThreadMessage } from "@sila/core";
  import type { AttachmentPreview } from "@sila/core";
  import type { MessageFormStatus } from "../../forms/messageFormStatus";
  import { ArrowDown } from "lucide-svelte";
  import { Images } from "lucide-svelte";
  import type { VisibleMessage } from "./chatTypes";
  import ChatAppPendingAssistantMessage from "./ChatAppPendingAssistantMessage.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { provideChatAppData } from "./chatAppContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";

  const SCROLL_BUTTON_THRESHOLD_PX = 40;
  const BOTTOM_THRESHOLD_PX = 0;

  let { data }: { data: ChatAppData } = $props();
  provideChatAppData(data);
  const clientState = useClientState();
  const spaceTelemetry = $derived(clientState.currentSpaceState?.spaceTelemetry);
  let scrollableElement = $state<HTMLElement | undefined>(undefined);
  let messages = $state<Vertex[]>([]);
  let shouldAutoScroll = $state(true);
  let formStatus: MessageFormStatus = $state("can-send-message");
  let scrollTop = $state(0);
  let scrollHeight = $state(0);
  let clientHeight = $state(0);
  let hasFiles = $state(false);
  let sendFormEl = $state<HTMLElement | null>(null);
  let sendFormHeight = $state(0);

  let lastMessageTxt: string | null = null;
  let lastProcessMessagesExpanded = $state(false);
  let isScrollingProgrammatically = $state(false);

  let distFromBottom = $derived(scrollHeight - scrollTop - clientHeight);
  let isAtBottom = $derived(distFromBottom <= BOTTOM_THRESHOLD_PX);

  const visibleMessages = $derived.by(() => {
    const messagesToShow: VisibleMessage[] = [];
    let progressVertices: Vertex[] = [];

    for (const vertex of messages) {
      const role = vertex.getProperty("role");

      if (role === "user" || role === "error") {
        messagesToShow.push({ vertex, progressVertices });
        progressVertices = [];
      } else if (role === "tool-results") {
        progressVertices.push(vertex);
        continue;
      } else {
        // If we have tool requests, consider tht message as a progress message
        const toolRequests = vertex.getProperty("toolRequests");
        if (toolRequests === undefined) {
          messagesToShow.push({ vertex, progressVertices });
          progressVertices = [];
          continue;
        }

        progressVertices.push(vertex);
      }
    }

    // Or if we have progress vertices it means we don't have a final messaage at the end
    if (progressVertices.length > 0) {
      messagesToShow.push({ vertex: undefined, progressVertices });
    }

    return messagesToShow;
  });
  const lastMessageIsByUser = $derived.by(() =>
    visibleMessages.length > 0
      ? visibleMessages[visibleMessages.length - 1].vertex?.getProperty(
          "role"
        ) === "user"
      : false
  );

  let lastMessageId = $derived.by(() =>
    messages.length > 0 ? messages[messages.length - 1].id : undefined
  );

  let showScrollDown = $derived(distFromBottom > SCROLL_BUTTON_THRESHOLD_PX);
  let scrollButtonOffset = $derived(Math.max(sendFormHeight + 16, 48));

  $effect(() => {
    if (!sendFormEl || typeof ResizeObserver === "undefined") {
      return;
    }

    sendFormHeight = sendFormEl.getBoundingClientRect().height;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      sendFormHeight = entry.contentRect.height;
    });
    resizeObserver.observe(sendFormEl);

    return () => {
      resizeObserver.disconnect();
    };
  });

  function updateScrollMetrics() {
    if (!scrollableElement) return;
    scrollTop = scrollableElement.scrollTop;
    scrollHeight = scrollableElement.scrollHeight;
    clientHeight = scrollableElement.clientHeight;
  }

  function handleScroll() {
    updateScrollMetrics();
    // Only update auto-scroll if this is a user scroll (not programmatic)
    if (!isScrollingProgrammatically) {
      shouldAutoScroll = isAtBottom;
    }
  }

  // Auto-scroll when content updates and auto-scroll is enabled
  let lastScrollHeight = $state(0);
  $effect(() => {
    if (shouldAutoScroll && scrollHeight > 0 && scrollHeight !== lastScrollHeight) {
      lastScrollHeight = scrollHeight;
      scrollToBottom();
    }
  });

  $effect(() => {
    if (!lastMessageId) return;

    const msgObs = data.observeMessage(lastMessageId, (msg) => {
      updateFormStatus(msg);
      if (msg.text !== lastMessageTxt) {
        lastMessageTxt = msg.text;
        // Scroll when message content updates if auto-scroll is enabled
        if (shouldAutoScroll) {
          scrollToBottom();
        }
      }
    });

    return () => {
      msgObs();
    };
  });

  function refreshHasFiles() {
    hasFiles = data.hasStoredFiles();
  }

  function updateFormStatus(lastMessage: ThreadMessage | undefined) {
    if (!lastMessage) {
      formStatus = "can-send-message";
      return;
    }

    // Treat an in-flight assistant reply as in-progress, and also treat the latest user
    // message as in-progress since the agent is expected to answer right after it.
    if (
      (lastMessage.role === "assistant" && lastMessage.inProgress) ||
      lastMessage.role === "user"
    ) {
      formStatus = "ai-message-in-progress";
      return;
    }

    formStatus = "can-send-message";
  }

  onMount(() => {
    messages = data.messageVertices;
    refreshHasFiles();
    spaceTelemetry?.chatOpened({
      chat_id: data.threadId,
      assistant_id: data.configId,
    });

    const msgsObs = data.observeNewMessages((vertices) => {
      // When new messages arrive, enable auto-scroll and scroll to bottom
      shouldAutoScroll = true;
      scrollToBottom();
      messages = vertices;
      refreshHasFiles();
      tick().then(updateScrollMetrics);
    });
    // @TODO temporary: subscribe to message updates for edits/branch switching
    const updateObs = data.onUpdate((vertices) => {
      messages = vertices;
      refreshHasFiles();
      tick().then(updateScrollMetrics);
    });

    tick().then(() => {
      scrollToBottom();
      updateScrollMetrics();
    });

    const onResize = () => updateScrollMetrics();
    window.addEventListener("resize", onResize);

    return () => {
      msgsObs();
      updateObs();
      window.removeEventListener("resize", onResize);
    };
  });

  function scrollToBottom(smooth: boolean = false, force: boolean = false) {
    if (!scrollableElement) return;
    
    // Only check shouldAutoScroll if not forced (e.g., when user clicks scroll button)
    if (!force && !shouldAutoScroll) return;

    // If forced (user clicked button), enable auto-scroll
    if (force) {
      shouldAutoScroll = true;
    }

    isScrollingProgrammatically = true;
    if (smooth) {
      scrollableElement.scrollTo({
        top: scrollableElement.scrollHeight,
        behavior: "smooth",
      });
      timeout(() => {
        isScrollingProgrammatically = false;
      }, 400);
    } else {
      scrollableElement.scrollTo(0, scrollableElement.scrollHeight);
      // Clear flag after scroll completes
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isScrollingProgrammatically = false;
        });
      });
    }
  }


  // Using shared AttachmentPreview from core

  async function sendMsg(query: string, attachments?: AttachmentPreview[]) {
    // Wait for the message to be created and attachments to be saved
    await data.newMessage({ role: "user", text: query, attachments });
    spaceTelemetry?.chatSent({
      thread_id: data.threadId,
      config_id: data.configId,
      message_length: query.length,
      role: "user",
      attachments_count: attachments?.length ?? 0,
    });
    // Always scroll to bottom when sending a message, and enable auto-scroll
    shouldAutoScroll = true;
    timeout(scrollToBottom, 100);
  }

  async function stopMsg() {
    data.triggerEvent("stop-message", {});
  }

  function openChatFiles() {
    const filesRoot = data.getFilesRoot(true);
    if (!filesRoot) {
      console.warn("Chat files root not found");
      return;
    }

    clientState.layout.swins.open(swinsLayout.files.key, { filesRoot }, "Chat files");
  }

  export async function scrollToMessage(messageId: string) {
    if (!scrollableElement) {
      console.warn("scrollToMessage: scrollable element not found");
      return;
    }
    await tick();
    const el = scrollableElement.querySelector(
      `[data-vertex-id="${messageId}"]`
    );
    if (!el) {
      console.warn(
        `scrollToMessage: element with vertex id "${messageId}" not found`
      );
      return;
    }
    (el as HTMLElement).scrollIntoView({ block: "start" });
  }
</script>

<div
  class="flex flex-col w-full h-full overflow-hidden relative"
  data-component="chat-app"
>
  {#if hasFiles}
    <button
      class="btn-icon btn-sm preset-outline absolute top-3 right-3 z-10 flex items-center gap-2"
      type="button"
      aria-label="View chat files"
      onclick={openChatFiles}
    >
      <Images size={16} />
    </button>
  {/if}
  <div
    class="flex-grow overflow-y-auto pt-2"
    bind:this={scrollableElement}
    onscroll={handleScroll}
  >
    <div class="w-full max-w-4xl mx-auto">
      {#each visibleMessages as visibleMessage, index (visibleMessage.vertex?.id ?? "in-progress")}
        <ChatAppMessage 
          {visibleMessage} 
          {data} 
          isLastMessage={index === visibleMessages.length - 1}
          lastProcessMessagesExpanded={lastProcessMessagesExpanded}
          onLastProcessMessagesExpandedChange={(expanded) => {
            lastProcessMessagesExpanded = expanded;
          }}
        />
      {/each}
      {#if lastMessageIsByUser}
        <ChatAppPendingAssistantMessage {data} />
      {/if}
    </div>
  </div>
  {#if showScrollDown}
    <button
      class="absolute left-1/2 -translate-x-1/2 z-10 btn-icon bg-surface-50-950 border border-surface-100-900 rounded-full shadow"
      style={`bottom: ${scrollButtonOffset}px`}
      aria-label="Scroll to bottom"
      onclick={() => scrollToBottom(true, true)}
    >
      <ArrowDown size={18} />
    </button>
  {/if}
  <div class="min-h-min" bind:this={sendFormEl}>
    <section class="max-w-4xl mx-auto py-2 px-2">
      <SendMessageForm
        onSend={sendMsg}
        onStop={stopMsg}
        status={formStatus}
        draftId={data.threadId}
        {data}
      />
    </section>
  </div>
</div>
