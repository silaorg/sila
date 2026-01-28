<script lang="ts">
  import ChatAppToolUsageItem from "../../comps/apps/chat/ChatAppToolUsageItem.svelte";
  import type { ToolUsageMessagePair } from "../../comps/apps/chat/chatTypes";

  let { messages, index = 0 }: { messages: ToolUsageMessagePair[]; index?: number } =
    $props();

  let currentIndex = $state(index);

  const current = $derived.by(() => messages[currentIndex]);
  const hasPrev = $derived(currentIndex > 0);
  const hasNext = $derived(currentIndex < messages.length - 1);

  const argsEntries = $derived.by(() => {
    const args = current?.toolPair.request.arguments || {};
    return Object.entries(args);
  });

  const resultString = $derived.by(() => {
    const result = current?.toolPair.result?.result;
    if (result === undefined) return "";
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  });

  function prev() {
    if (!hasPrev) return;
    currentIndex -= 1;
  }

  function next() {
    if (!hasNext) return;
    currentIndex += 1;
  }
</script>

<div class="flex flex-col w-full h-full min-h-0">
  {#if current}
    <div class="flex-1 min-h-0 overflow-y-auto pr-1">
      <div class="flex flex-col gap-4">
        <ChatAppToolUsageItem message={current} interactive={false} />

        <div class="space-y-3">
          <div class="text-xs uppercase tracking-wide opacity-60">Arguments</div>
          {#if argsEntries.length === 0}
            <div class="text-sm opacity-60">No arguments</div>
          {:else}
            <div class="text-sm space-y-1">
              {#each argsEntries as [key, value]}
                <div class="flex items-start gap-2">
                  <div class="font-mono text-xs opacity-70">{key}</div>
                  <div class="text-sm">
                    {typeof value === "string"
                      ? value
                      : JSON.stringify(value)}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="space-y-3">
          <div class="text-xs uppercase tracking-wide opacity-60">Result</div>
          {#if current.toolPair.result === null}
            <div class="text-sm opacity-60">In progress</div>
          {:else if !resultString}
            <div class="text-sm opacity-60">No result</div>
          {:else}
            <pre class="text-xs whitespace-pre-wrap rounded-md border border-surface-100-900 p-3">
{resultString}
            </pre>
          {/if}
        </div>
      </div>
    </div>

    <div class="border-t border-surface-100-900 pt-3">
      <div class="flex items-center justify-between gap-2">
        <button
          class="btn btn-sm preset-tonal"
          type="button"
          onclick={prev}
          disabled={!hasPrev}
      >
        Prev
      </button>
      <div class="text-xs opacity-60">
        {currentIndex + 1} / {messages.length}
      </div>
        <button
          class="btn btn-sm preset-tonal"
          type="button"
          onclick={next}
          disabled={!hasNext}
        >
          Next
        </button>
      </div>
    </div>
  {:else}
    <div class="text-sm opacity-60">No tool usage selected.</div>
  {/if}
</div>
