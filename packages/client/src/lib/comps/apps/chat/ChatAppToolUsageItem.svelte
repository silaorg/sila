<script lang="ts">
  import {
    BookOpen,
    Check,
    FilePenLine,
    Image as ImageIcon,
    Search,
    Wrench,
  } from "lucide-svelte";
  import Spinner from "../../ui/Spinner.svelte";
  import type { ToolUsageMessagePair } from "./chatTypes";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  import { i18n } from "@sila/client";

  const {
    message,
    messages,
    index,
    interactive = true,
  }: {
    message: ToolUsageMessagePair;
    messages?: ToolUsageMessagePair[];
    index?: number;
    interactive?: boolean;
  } = $props();

  const clientState = useClientState();

  const toolName = $derived(message.toolPair.request.name);
  const displayName = $derived.by(() => {
    const normalizedName = toolName.replace(/_/g, " ").trim();
    if (!normalizedName) return toolName;
    return normalizedName[0].toUpperCase() + normalizedName.slice(1);
  });
  const args = $derived(message.toolPair.request.arguments || {});
  const normalized = $derived(toolName.toLowerCase());
  const inProgress = $derived(message.toolPair.result === null);

  const preview = $derived.by(() => {
    if (normalized.includes("search")) {
      return args.query || args.q || "";
    }
    if (normalized.includes("read")) {
      return args.url || args.uri || args.path || "";
    }
    if (normalized.includes("image")) {
      return args.prompt || "";
    }
    if (normalized.includes("edit") || normalized.includes("write")) {
      return args.title || args.path || args.name || "";
    }
    const firstString = Object.values(args).find((value) =>
      typeof value === "string"
    );
    return firstString || "";
  });

  const ToolIcon = $derived.by(() => {
    if (normalized.includes("search")) return Search;
    if (normalized.includes("read")) return BookOpen;
    if (normalized.includes("image")) return ImageIcon;
    if (normalized.includes("edit") || normalized.includes("write")) {
      return FilePenLine;
    }
    return Wrench;
  });

  const isClickable = $derived(
    interactive && Array.isArray(messages) && typeof index === "number"
  );

  function openDetails() {
    if (!isClickable) return;
    clientState.layout.swins.open(
      swinsLayout.toolUsageDetails.key,
      { messages, index },
      i18n.texts.chat.toolUsageTitle
    );
  }
</script>

<div
  class="border border-surface-100-900 p-2 rounded-md"
  class:cursor-pointer={isClickable}
  class:hover:border-surface-200-800={isClickable}
  role={isClickable ? "button" : undefined}
  tabindex={isClickable ? 0 : undefined}
  onclick={openDetails}
>
  <span class="inline-flex items-center gap-2 min-w-0">
    {#if inProgress}
      <Spinner />
    {:else}
      <Check size={14} class="opacity-70" />
    {/if}
    <svelte:component this={ToolIcon} size={14} class="opacity-70" />
    <span class="font-medium">{displayName}</span>
    {#if preview}
      <span class="opacity-60 truncate max-w-[320px]">"{preview}"</span>
    {/if}
  </span>
</div>
