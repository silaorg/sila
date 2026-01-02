<script lang="ts">
  import { Sparkles } from "lucide-svelte";
  import type { ChatAppData } from "@sila/core";
  import { i18n } from "@sila/client";

  let { data }: { data: ChatAppData } = $props();

  // Keep it simple: use the config name if available, otherwise fallback to "AI"
  let configName = $derived(data.configAppConfig?.name || i18n.texts.chat.aiLabel);
</script>

<div class="flex gap-3 px-4 py-2">
  <div class="flex-shrink-0 mt-1">
    <div class="w-8 h-8 rounded-full flex items-center justify-center">
      <Sparkles size={18} />
    </div>
  </div>
  <div class="min-w-0 max-w-[85%]">
    <div class="flex gap-2 mt-2">
      <span class="font-bold cursor-default">{configName || i18n.texts.chat.aiLabel} </span>

      <span class="opacity-70">•</span>
      <div class="flex items-center gap-1 group">
        <span class="text-shimmer">{i18n.texts.chat.processing}</span>
      </div>
    </div>
  </div>
</div>
