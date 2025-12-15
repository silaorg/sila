<script lang="ts">
  import { CircleAlert } from "lucide-svelte";
  import { ChevronDown, ChevronRight } from "lucide-svelte";
  import type { ThreadMessage } from "@sila/core";
  import type { ChatAppData } from "@sila/core";
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import ChatAppMessageControls from "./ChatAppMessageControls.svelte";
  import ChatAppMessageEditForm from "./ChatAppMessageEditForm.svelte";
  import type { VisibleMessage } from "./chatTypes";
  import MarkdownCode from "@sila/client/comps/markdown/markdown-components/MarkdownCode.svelte";

  let {
    visibleMessage,
    data,
  }: { visibleMessage: VisibleMessage; data: ChatAppData } = $props();

  const vertex = $derived(visibleMessage.vertex);

  let message: ThreadMessage | undefined = $state(undefined);
  let isExpanded = $state(false);

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

  function retry() {
    if (!vertex) return;
    data.retryMessage(vertex.id);
  }

  type ParsedError = {
    mainMessage: string;
    info: Record<string, unknown> | null;
    raw: unknown | null;
  };

  function parseErrorPayload(text: string | undefined | null): ParsedError {
    const fallback: ParsedError = {
      mainMessage: text?.trim() || "Unknown error",
      info: null,
      raw: null,
    };
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        // Common shapes: { error: { message, type, code, param, ... } } or { message, ... }
        const errObj: any =
          (parsed as any).error && typeof (parsed as any).error === "object"
            ? (parsed as any).error
            : parsed;
        const mainMessage: string =
          (errObj && typeof errObj.message === "string" && errObj.message) ||
          fallback.mainMessage;
        // Build info without the main message field
        const info: Record<string, unknown> = {};
        if (errObj && typeof errObj === "object") {
          for (const key of Object.keys(errObj)) {
            if (key === "message") continue;
            (info as any)[key] = (errObj as any)[key];
          }
        }
        return {
          mainMessage,
          info: Object.keys(info).length > 0 ? info : null,
          raw: parsed,
        };
      }
      // Non-object JSON (e.g., string/number) — treat as simple message
      return { mainMessage: String(parsed), info: null, raw: parsed };
    } catch {
      // Not JSON — return as plain text
      return fallback;
    }
  }

  let parsed = $derived.by(() => parseErrorPayload(message?.text));
  let hasDetails = $derived(
    !!parsed.info && Object.keys(parsed.info || {}).length > 0
  );

  let codeToken = $derived.by(() => {
    const target = parsed.raw ?? parsed.info ?? message?.text ?? "";
    const text =
      typeof target === "string" ? target : JSON.stringify(target, null, 2);
    return { lang: "json", text } as any;
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
        <p class="font-bold">{parsed.mainMessage}</p>
      </div>
    </div>
    {#if hasDetails}
      <div class="mt-1">
        <button
          class="flex items-center gap-1 opacity-80 hover:opacity-100"
          onclick={() => (isExpanded = !isExpanded)}
          aria-expanded={isExpanded}
        >
          <span class="text-sm">{isExpanded ? "Hide details" : "Show details"}</span>
          {#if isExpanded}
            <ChevronDown size={12} class="opacity-70" />
          {:else}
            <ChevronRight size={12} class="opacity-70" />
          {/if}
        </button>
        {#if isExpanded}
          <div class="mt-2 relative rounded-lg chat-message w-full min-w-0 overflow-hidden">
            <MarkdownCode token={codeToken} />
          </div>
        {/if}
      </div>
    {/if}
    <div class="mt-2 flex gap-2">
      <button class="btn preset-filled-surface-500" onclick={retry}>Retry</button>
    </div>
  </div>
</div>
