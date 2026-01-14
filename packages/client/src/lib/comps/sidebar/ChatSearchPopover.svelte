<script lang="ts">
  import { Popover } from "@skeletonlabs/skeleton-svelte";
  import { MessageCircle, Search, X } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import {
    buildChatSearchEntries,
    searchChatThreads,
    type SearchResult,
    type SearchThreadEntry,
  } from "@sila/client/utils/chatSearch";

  const clientState = useClientState();

  let open = $state(false);
  let query = $state("");
  let entries = $state<SearchThreadEntry[]>([]);
  let isIndexing = $state(false);
  let error = $state<string | null>(null);

  const results = $derived.by(() =>
    searchChatThreads(entries, query)
  );

  const recentThreads = $derived.by(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const sorted = [...entries].sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    );
    const withinWeek = sorted.filter((entry) => (entry.updatedAt ?? 0) >= cutoff);
    return (withinWeek.length > 0 ? withinWeek : sorted).slice(0, 8);
  });

  $effect(() => {
    if (!open) return;
    void buildIndex();
  });

  async function buildIndex() {
    if (!clientState.currentSpace) {
      entries = [];
      return;
    }

    isIndexing = true;
    error = null;

    try {
      entries = await buildChatSearchEntries(clientState.currentSpace);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isIndexing = false;
    }
  }

  function openThread(result: SearchResult | SearchThreadEntry) {
    const layout = clientState.currentSpaceState?.layout;
    if (!layout) return;

    layout.openChatTab(result.threadId, result.title ?? "New chat");
    open = false;
  }

  function closePopover() {
    open = false;
  }
</script>

<Popover
  {open}
  onOpenChange={(event) => (open = event.open)}
  positioning={{ placement: "bottom", strategy: "fixed" }}
  arrow={false}
  triggerBase="p-2 rounded hover:preset-tonal"
  positionerClasses="!left-1/2 !top-16 !-translate-x-1/2"
  contentBase="card bg-surface-50-950 border border-surface-200-800 shadow-2xl w-[520px] rounded-2xl overflow-hidden"
>
  {#snippet trigger()}
    <button type="button" data-role="open-search" aria-label="Search chats">
      <Search size={18} />
    </button>
  {/snippet}

  {#snippet content()}
    <div class="flex items-center gap-2 border-b border-surface-200-800">
      <div class="relative flex-1">
        <input
          class="input w-full pl-10 text-base border border-surface-200-800 rounded-xl"
          type="text"
          placeholder="Search chats..."
          bind:value={query}
        />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">
          <Search size={16} />
        </span>
      </div>
      <button
        type="button"
        class="btn-icon hover:preset-tonal"
        onclick={closePopover}
        aria-label="Close search"
      >
        <X size={18} />
      </button>
    </div>

    <div class="px-4 py-3 space-y-4">
      {#if error}
        <p class="text-sm text-error-500">{error}</p>
      {/if}

      {#if isIndexing}
        <p class="text-sm text-surface-500">Indexing chats…</p>
      {/if}

      {#if query.trim().length === 0}
        <div class="space-y-3">
          <p class="text-xs uppercase tracking-wide text-surface-500">Previous 7 days</p>
          {#if recentThreads.length === 0}
            <p class="text-sm text-surface-500">No recent conversations.</p>
          {:else}
            <ul class="space-y-1">
              {#each recentThreads as entry (entry.threadId)}
                <li>
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-100-900/50"
                    onclick={() => openThread(entry)}
                  >
                    <MessageCircle size={18} class="text-surface-500" />
                    <span class="text-sm font-medium truncate">{entry.title}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {:else if results.length === 0}
        <p class="text-sm text-surface-500">No results.</p>
      {:else}
        <ul class="space-y-1">
          {#each results as result (result.threadId)}
            <li>
              <button
                type="button"
                class="w-full flex flex-col gap-1 rounded-xl px-3 py-2 hover:bg-surface-100-900/50"
                onclick={() => openThread(result)}
              >
                <div class="flex items-center gap-3">
                  <MessageCircle size={18} class="text-surface-500" />
                  <span class="text-sm font-medium truncate">{result.title}</span>
                </div>
                <p class="text-xs text-surface-500 line-clamp-2 pl-7">
                  {result.snippet}
                </p>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/snippet}
</Popover>
