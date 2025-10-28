<script lang="ts">
  import { Sparkles, LoaderCircle } from "lucide-svelte";
  import type { ChatAppData } from "@sila/core";

  let { data }: { data: ChatAppData } = $props();

  // Keep it simple: use the config name if available, otherwise fallback to "AI"
  let configName = $derived(data.configAppConfig?.name || "AI");
</script>

<div class="flex gap-3 px-4 py-2">
  <div class="flex-shrink-0 mt-1">
    <div class="w-8 h-8 rounded-full flex items-center justify-center">
      <Sparkles size={18} />
    </div>
  </div>
  <div class="min-w-0 max-w-[85%]">
    <div class="flex gap-2 mt-2">
      <span class="font-bold cursor-default">{configName || "AI"} </span>

      <span class="opacity-70">•</span>
      <div class="flex items-center gap-1 group">
        <LoaderCircle size={12} class="animate-spin" /><span
          class="text-shimmer">Processing</span
        >
      </div>
    </div>
  </div>
</div>
