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

  const SCROLL_BUTTON_THRESHOLD_PX = 40;
  const BOTTOM_THRESHOLD_PX = 0;

  let { data }: { data: ChatAppData } = $props();
  const clientState = useClientState();
  let scrollableElement = $state<HTMLElement | undefined>(undefined);
  let messages = $state<Vertex[]>([]);
  let shouldAutoScroll = $state(true);
  let formStatus: MessageFormStatus = $state("can-send-message");
  let isProgrammaticScroll = $state(true);
  let scrollTop = $state(0);
  let scrollHeight = $state(0);
  let clientHeight = $state(0);
  let hasFiles = $state(false);

  let lastMessageTxt: string | null = null;
  let programmaticScrollTimeout: (() => void) | undefined;

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

  function updateScrollMetrics() {
    if (!scrollableElement) return;
    scrollTop = scrollableElement.scrollTop;
    scrollHeight = scrollableElement.scrollHeight;
    clientHeight = scrollableElement.clientHeight;
  }

  function handleScroll() {
    // We only detect when the user scrolls (not when it's scrolled programmatically)
    if (!isProgrammaticScroll) {
      updateScrollMetrics();
      shouldAutoScroll = isAtBottom;
    }
    updateScrollMetrics();
  }

  $effect(() => {
    if (!lastMessageId) return;

    const msgObs = data.observeMessage(lastMessageId, (msg) => {
      updateFormStatus(msg);
      if (msg.text !== lastMessageTxt) {
        lastMessageTxt = msg.text;
        if (msg.role === "assistant") {
          scrollOnlyIfAutoscroll();
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

    if (lastMessage.role === "assistant" && lastMessage.inProgress) {
      formStatus = "ai-message-in-progress";
      return;
    }

    if (lastMessage.role === "user") {
      formStatus = "disabled";
      return;
    }

    formStatus = "can-send-message";
  }

  onMount(() => {
    messages = data.messageVertices;
    refreshHasFiles();

    const msgsObs = data.observeNewMessages((vertices) => {
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

  function scrollToBottom(smooth: boolean = false) {
    if (!scrollableElement) {
      console.warn("scrollable element not found");
      return;
    }

    isProgrammaticScroll = true;
    if (smooth) {
      scrollableElement.scrollTo({
        top: scrollableElement.scrollHeight,
        behavior: "smooth",
      });
    } else {
      scrollableElement.scrollTo(0, scrollableElement.scrollHeight);
    }
    // Reset the flag after the scroll animation would have completed
    programmaticScrollTimeout?.();
    programmaticScrollTimeout = timeout(
      () => {
        isProgrammaticScroll = false;
      },
      smooth ? 400 : 100
    );
  }

  function scrollOnlyIfAutoscroll() {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }

  // Using shared AttachmentPreview from core

  async function sendMsg(query: string, attachments?: AttachmentPreview[]) {
    // Wait for the message to be created and attachments to be saved
    await data.newMessage({ role: "user", text: query, attachments });
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

    clientState.layout.swins.open("files", { filesRoot }, "Chat files");
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
    isProgrammaticScroll = true;
    (el as HTMLElement).scrollIntoView({ block: "start" });
    programmaticScrollTimeout?.();
    programmaticScrollTimeout = timeout(() => {
      isProgrammaticScroll = false;
    }, 100);
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
      {#each visibleMessages as visibleMessage (visibleMessage.vertex?.id ?? "in-progress")}
        <ChatAppMessage {visibleMessage} {data} />
      {/each}
      {#if lastMessageIsByUser}
        <ChatAppPendingAssistantMessage {data} />
      {/if}
    </div>
  </div>
  {#if showScrollDown}
    <button
      class="absolute left-1/2 -translate-x-1/2 bottom-30 z-10 btn-icon bg-surface-50-950 border border-surface-100-900 rounded-full shadow"
      aria-label="Scroll to bottom"
      onclick={() => scrollToBottom(true)}
    >
      <ArrowDown size={18} />
    </button>
  {/if}
  <div class="min-h-min">
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
