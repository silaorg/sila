<script lang="ts">
  import { CircleAlert } from "lucide-svelte";
  import type { ThreadMessage } from "@sila/core";
  import type { ChatAppData } from "@sila/core";
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import ChatAppMessageControls from "./ChatAppMessageControls.svelte";
  import ChatAppMessageEditForm from "./ChatAppMessageEditForm.svelte";
  import type { VisibleMessage } from "./chatTypes";

  let {
    visibleMessage,
    data,
  }: { visibleMessage: VisibleMessage; data: ChatAppData } = $props();

  const vertex = $derived(visibleMessage.vertex);

  let message: ThreadMessage | undefined = $state(undefined);

  $effect(() => {
    if (vertex) {
      message = vertex.getAsTypedObject<ThreadMessage>();
    } else {
      message = undefined;
    }
  });

  onMount(() => {
    if (!vertex) return;
    const unobserve = data.observeMessage(vertex.id, (msg) => {
      message = msg;
    });

    return () => {
      unobserve();
    };
  });
</script>

<div class="flex gap-3 px-4 py-2">
  <div class="flex-shrink-0 mt-1">
    <div class="w-8 h-8 rounded-full flex items-center justify-center">
      <CircleAlert size={18} />
    </div>
  </div>
  <div class="min-w-0 max-w-[85%]">
    <div class="flex items-center justify-between gap-2 mt-2">
      <div class="flex items-center gap-2">
        <p class="font-bold">{message?.text}</p>
      </div>
    </div>
  </div>
</div>
