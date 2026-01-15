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
  import { ArrowDown, ChevronDown, ChevronUp, Images, Search, X } from "lucide-svelte";
  import type { VisibleMessage } from "./chatTypes";
  import ChatAppPendingAssistantMessage from "./ChatAppPendingAssistantMessage.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { provideChatAppData } from "./chatAppContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  import { i18n } from "@sila/client";
  import {
    clearActivePageSearchMatch,
    clearPageSearchHighlights,
    highlightPageSearchMatches,
    setActivePageSearchMatch,
    type PageSearchController,
    type PageSearchMatch,
  } from "@sila/client/utils/pageSearch";

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
  let messageContainerEl = $state<HTMLElement | null>(null);

  let lastMessageTxt: string | null = null;
  let lastProcessMessagesExpanded = $state(false);
  let isScrollingProgrammatically = $state(false);
  let pageSearchOpen = $state(false);
  let pageSearchQuery = $state("");
  let pageSearchMatches = $state<PageSearchMatch[]>([]);
  let pageSearchActiveIndex = $state(0);
  let pageSearchActiveMatch = $state<PageSearchMatch | null>(null);
  let pageSearchInputEl = $state<HTMLInputElement | null>(null);
  let pageSearchTimer: number | null = null;

  const isMac =
    typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  let distFromBottom = $derived(scrollHeight - scrollTop - clientHeight);
  let isAtBottom = $derived(distFromBottom <= BOTTOM_THRESHOLD_PX);
  let pageSearchEnabled = $derived(
    clientState.pageSearchConfig.enabled && !clientState.pageSearchConfig.useNative
  );
  let pageSearchTotal = $derived(pageSearchMatches.length);
  let pageSearchIndex = $derived(pageSearchTotal > 0 ? pageSearchActiveIndex + 1 : 0);

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

  $effect(() => {
    if (!pageSearchOpen) return;
    messages;
    if (!messageContainerEl) return;
    tick().then(() => {
      schedulePageSearch();
    });
  });

  $effect(() => {
    if (!pageSearchOpen && messageContainerEl) {
      clearPageSearchHighlights(messageContainerEl);
      pageSearchMatches = [];
      pageSearchActiveIndex = 0;
      pageSearchActiveMatch = null;
    }
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

  function schedulePageSearch() {
    if (!pageSearchOpen) return;
    if (!messageContainerEl) return;
    if (pageSearchTimer) {
      window.clearTimeout(pageSearchTimer);
    }
    pageSearchTimer = window.setTimeout(() => {
      pageSearchTimer = null;
      applyPageSearch();
    }, 50);
  }

  function applyPageSearch() {
    if (!messageContainerEl) return;
    const result = highlightPageSearchMatches(messageContainerEl, pageSearchQuery, 1000);
    pageSearchMatches = result.matches;
    if (pageSearchMatches.length === 0) {
      clearActivePageSearchMatch(pageSearchActiveMatch);
      pageSearchActiveMatch = null;
      pageSearchActiveIndex = 0;
      return;
    }
    const nextIndex = Math.min(pageSearchActiveIndex, pageSearchMatches.length - 1);
    setActivePageSearchIndex(nextIndex);
  }

  function setActivePageSearchIndex(index: number) {
    if (pageSearchMatches.length === 0) return;
    clearActivePageSearchMatch(pageSearchActiveMatch);
    pageSearchActiveIndex = ((index % pageSearchMatches.length) + pageSearchMatches.length) % pageSearchMatches.length;
    const nextMatch = pageSearchMatches[pageSearchActiveIndex] ?? null;
    pageSearchActiveMatch = nextMatch;
    setActivePageSearchMatch(nextMatch);
  }

  function goToNextMatch() {
    if (pageSearchMatches.length === 0) return;
    setActivePageSearchIndex(pageSearchActiveIndex + 1);
  }

  function goToPrevMatch() {
    if (pageSearchMatches.length === 0) return;
    setActivePageSearchIndex(pageSearchActiveIndex - 1);
  }

  function openPageSearch() {
    if (!pageSearchEnabled) return;
    pageSearchOpen = true;
    tick().then(() => {
      pageSearchInputEl?.focus();
      pageSearchInputEl?.select();
      schedulePageSearch();
    });
  }

  function closePageSearch() {
    pageSearchOpen = false;
    pageSearchQuery = "";
  }

  function togglePageSearch() {
    if (pageSearchOpen) {
      closePageSearch();
    } else {
      openPageSearch();
    }
  }

  function handlePageSearchInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    pageSearchQuery = target?.value ?? "";
    pageSearchActiveIndex = 0;
    schedulePageSearch();
  }

  function handlePageSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePageSearch();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    }
  }

  const pageSearchController: PageSearchController = {
    open: openPageSearch,
    close: closePageSearch,
    toggle: togglePageSearch,
    setQuery: (value: string) => {
      pageSearchQuery = value;
      pageSearchActiveIndex = 0;
      schedulePageSearch();
    },
    next: goToNextMatch,
    prev: goToPrevMatch,
  };

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
    clientState.pageSearchController = pageSearchController;

    return () => {
      if (clientState.pageSearchController === pageSearchController) {
        clientState.pageSearchController = null;
      }
      if (pageSearchTimer) {
        window.clearTimeout(pageSearchTimer);
      }
      if (messageContainerEl) {
        clearPageSearchHighlights(messageContainerEl);
      }
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

    clientState.layout.swins.open(
      swinsLayout.files.key,
      { filesRoot },
      i18n.texts.chat.chatFilesTitle
    );
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
  {#if pageSearchOpen}
    <div
      class="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-xl border border-surface-200-800 bg-surface-50-950 px-3 py-2 shadow"
      data-testid="chat-page-search"
    >
      <Search size={14} />
      <input
        class="input h-8 min-w-[200px] bg-transparent px-2"
        placeholder="Find in chat"
        aria-label="Find in chat"
        bind:this={pageSearchInputEl}
        value={pageSearchQuery}
        oninput={handlePageSearchInput}
        onkeydown={handlePageSearchKeydown}
        data-testid="chat-page-search-input"
      />
      <span class="text-xs text-surface-500 hidden sm:inline">
        {isMac ? "⌘F" : "Ctrl+F"}
      </span>
      <span class="text-xs text-surface-500" data-testid="chat-page-search-count">
        {pageSearchIndex}/{pageSearchTotal}
      </span>
      <div class="flex items-center gap-1">
        <button
          class="btn-icon btn-sm preset-outline"
          type="button"
          aria-label="Find previous"
          onclick={goToPrevMatch}
        >
          <ChevronUp size={16} />
        </button>
        <button
          class="btn-icon btn-sm preset-outline"
          type="button"
          aria-label="Find next"
          onclick={goToNextMatch}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      <button
        class="btn-icon btn-sm preset-outline"
        type="button"
        aria-label="Close find bar"
        onclick={closePageSearch}
      >
        <X size={16} />
      </button>
    </div>
  {/if}
  <div class="absolute top-3 right-3 z-10 flex items-center gap-2">
    {#if pageSearchEnabled}
      <button
        class="btn-icon btn-sm preset-outline sm:hidden"
        type="button"
        aria-label="Find in chat"
        onclick={openPageSearch}
      >
        <Search size={16} />
      </button>
    {/if}
    {#if hasFiles}
      <button
        class="btn-icon btn-sm preset-outline flex items-center gap-2"
        type="button"
        aria-label={i18n.texts.chat.viewFilesAria}
        onclick={openChatFiles}
      >
        <Images size={16} />
      </button>
    {/if}
  </div>
  <div
    class="flex-grow overflow-y-auto pt-2"
    bind:this={scrollableElement}
    onscroll={handleScroll}
  >
    <div class="w-full max-w-4xl mx-auto" bind:this={messageContainerEl}>
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
      aria-label={i18n.texts.chat.scrollToBottomAria}
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
