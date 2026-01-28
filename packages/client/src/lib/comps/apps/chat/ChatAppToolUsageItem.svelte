<script lang="ts">
  import {
    BookOpen,
    Check,
    Eye,
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
  const toolNameKey = $derived(toolName.toLowerCase());
  const i18nName = $derived(i18n.texts.chat.toolNames[toolNameKey]);
  const displayToolName = $derived(i18nName || displayName);
  const normalized = $derived(toolName.toLowerCase());
  const inProgress = $derived(message.toolPair.result === null);

  const args = $derived(
    (message.toolPair.request.arguments || {}) as Record<string, unknown>
  );

  // Find the first non-empty string from a list of keys.
  function pickString(
    source: Record<string, unknown>,
    keys: string[]
  ): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    return "";
  }

  // Patch tool: use the first word in the patch line as a quick path hint.
  function patchPath(patch: unknown): string {
    if (typeof patch !== "string") return "";
    return patch.trim().split(/\s+/)[0] || "";
  }

  const preview = $derived.by(() => {
    if (normalized.includes("look") || normalized.includes("inspect")) {
      return pickString(args, [
        "url",
        "uri",
        "path",
        "image",
        "imageUrl",
        "prompt",
      ]);
    }
    if (normalized.includes("search")) {
      return pickString(args, ["query", "q"]);
    }
    if (normalized.includes("read")) {
      return pickString(args, ["url", "uri", "path"]);
    }
    if (normalized.includes("image")) {
      return pickString(args, ["prompt"]);
    }
    if (
      normalized.includes("apply_search_replace_patch") ||
      normalized.includes("edit") ||
      normalized.includes("write")
    ) {
      const fromPatch = patchPath(args.patch);
      if (fromPatch) return fromPatch;
      return pickString(args, ["path", "uri", "url", "title", "name"]);
    }
    if (normalized.includes("ls") || normalized.includes("list")) {
      return pickString(args, ["path", "cwd", "directory"]);
    }

    const firstString = Object.values(args).find((value) =>
      typeof value === "string"
    );
    return (firstString as string | undefined) || "";
  });

  const ToolIcon = $derived.by(() => {
    if (
      normalized.includes("apply_search_replace_patch") ||
      normalized.includes("edit") ||
      normalized.includes("write")
    ) {
      return FilePenLine;
    }
    if (normalized.includes("look") || normalized.includes("inspect")) {
      return Eye;
    }
    if (normalized.includes("search")) return Search;
    if (normalized.includes("read")) return BookOpen;
    if (normalized.includes("image")) return ImageIcon;
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

<button
  class="border border-surface-100-900 p-2 rounded-md text-left"
  class:cursor-pointer={isClickable}
  class:hover:border-surface-200-800={isClickable}
  type="button"
  disabled={!isClickable}
  onclick={openDetails}
>
  <span class="inline-flex items-center gap-2 min-w-0">
    {#if inProgress}
      <Spinner />
    {:else}
      <Check size={14} class="opacity-70" />
    {/if}
    <ToolIcon size={14} class="opacity-70" />
    <span class="font-medium">{displayToolName}</span>
    {#if preview}
      <span class="opacity-60 truncate max-w-[320px]">"{preview}"</span>
    {/if}
  </span>
</button>
