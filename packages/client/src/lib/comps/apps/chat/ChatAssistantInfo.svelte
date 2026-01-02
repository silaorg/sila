<script lang="ts">
  let { configId }: { configId?: string } = $props();
  import { i18n } from "@sila/client";
</script>

<div class="text-sm space-y-1">
  <div>
    <span class="opacity-70">{i18n.texts.chat.assistantConfigIdLabel}</span>
    {configId || i18n.texts.chat.unknown}
  </div>
</div>

