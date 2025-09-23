<script lang="ts">
  import SendMessageForm from "../forms/SendMessageForm.svelte";
  import ChatAppMessage from "./ChatAppMessage.svelte";
  import { onMount, tick } from "svelte";
  import { timeout } from "@sila/core";
  import { ChatAppData } from "@sila/core";
  import type { Vertex } from "@sila/core";
  import type { ThreadMessage } from "@sila/core";
  import type { AttachmentPreview } from "@sila/core";
  import type { MessageFormStatus } from "../forms/messageFormStatus";

  let { data }: { data: ChatAppData } = $props();
  let scrollableElement = $state<HTMLElement | undefined>(undefined);
  let messages = $state<Vertex[]>([]);
  let shouldAutoScroll = $state(true);
  let formStatus: MessageFormStatus = $state("can-send-message");
  let isProgrammaticScroll = $state(true);
  let lastMessageId = $derived.by(() =>
    messages.length > 0 ? messages[messages.length - 1].id : undefined
  );

  let lastMessageTxt: string | null = null;
  let programmaticScrollTimeout: (() => void) | undefined;

  function isAtBottom() {
    if (!scrollableElement) return false;

    const threshold = 0;
    return (
      scrollableElement.scrollHeight -
        scrollableElement.scrollTop -
        scrollableElement.clientHeight <=
      threshold
    );
  }

  function handleScroll() {
    // We only detect when the user scrolls (not when it's scrolled programmatically)
    if (!isProgrammaticScroll) {
      shouldAutoScroll = isAtBottom();
    }
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

    const msgsObs = data.observeNewMessages((vertices) => {
      scrollToBottom();
      messages = vertices;
    });
    // @TODO temporary: subscribe to message updates for edits/branch switching
    const updateObs = data.onUpdate((vertices) => {
      messages = vertices;
    });

    tick().then(() => {
      scrollToBottom();
    });

    return () => {
      msgsObs();
      updateObs();
    };
  });

  function scrollToBottom() {
    if (!scrollableElement) {
      console.warn("scrollable element not found");
      return;
    }

    isProgrammaticScroll = true;
    scrollableElement.scrollTo(0, scrollableElement.scrollHeight);
    // Reset the flag after the scroll animation would have completed
    programmaticScrollTimeout?.();
    programmaticScrollTimeout = timeout(() => {
      isProgrammaticScroll = false;
    }, 100);
  }

  function scrollOnlyIfAutoscroll() {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }

  // Using shared AttachmentPreview from core

  async function sendMsg(query: string, attachments?: AttachmentPreview[]) {
    // Wait for the message to be created and attachments to be saved
    await data.newMessage("user", query, undefined, attachments);
    timeout(scrollToBottom, 100);
  }

  async function stopMsg() {
    data.triggerEvent("stop-message", {});
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

<div class="flex flex-col w-full h-full overflow-hidden">
  <div
    class="flex-grow overflow-y-auto pt-2"
    bind:this={scrollableElement}
    onscroll={handleScroll}
  >
    <div class="w-full max-w-4xl mx-auto">
      {#each messages as vertex (vertex.id)}
        <ChatAppMessage {vertex} {data} />
      {/each}
    </div>
  </div>
  <div class="min-h-min">
    <section class="max-w-4xl mx-auto py-2 px-2">
      <SendMessageForm
        onSend={sendMsg}
        onStop={stopMsg}
        status={formStatus}
        draftId={data.threadId}
        maxLines={10}
        {data}
      />
    </section>
  </div>
</div>
