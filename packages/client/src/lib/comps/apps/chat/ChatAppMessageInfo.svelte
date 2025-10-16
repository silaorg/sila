<script lang="ts">
  import type { ThreadMessage } from "@sila/core";

  let {
    message,
    assistantName = "AI",
  }: { message: ThreadMessage; assistantName?: string } = $props();

  function getModelInfo(): { provider: string; model: string } | null {
    const provider =
      (message as any)?.modelProviderFinal ||
      (message as any)?.modelProvider ||
      null;
    const model =
      (message as any)?.modelIdFinal || (message as any)?.modelId || null;
    if (provider && model) return { provider, model };
    return null;
  }

  let modelInfo = $derived.by(() => getModelInfo());
</script>

<div class="text-sm space-y-1">
  <div>
    <span class="opacity-70">Assistant:</span>
    {assistantName}
  </div>

  {#if modelInfo}
    <div>
      <span class="opacity-70">Model:</span>
      {modelInfo.provider}/{modelInfo.model}
    </div>
  {/if}

  <div>
    <span class="opacity-70">Created:</span>
    {new Date(message._c).toLocaleString()}
  </div>

  {#if message.updatedAt}
    <div>
      <span class="opacity-70">Updated:</span>
      {new Date(message.updatedAt).toLocaleString()}
    </div>
  {/if}
</div>
