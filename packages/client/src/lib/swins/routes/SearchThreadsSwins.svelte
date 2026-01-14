<script lang="ts">
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import {
    buildChatSearchEntries,
    searchChatThreads,
    type SearchResult,
    type SearchThreadEntry,
  } from "@sila/client/utils/chatSearch";
  import Search from "lucide-svelte/icons/search";
  import RefreshCcw from "lucide-svelte/icons/refresh-ccw";

  const clientState = useClientState();

  let query = $state("");
  let entries = $state<SearchThreadEntry[]>([]);
  let isIndexing = $state(false);
  let error = $state<string | null>(null);
  let lastIndexedAt = $state<number | null>(null);

  const results = $derived.by(() =>
    searchChatThreads(entries, query)
  );

  onMount(() => {
    void buildIndex();
  });

  $effect(() => {
    if (!clientState.currentSpace) {
      entries = [];
      error = null;
      lastIndexedAt = null;
      return;
    }
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
      lastIndexedAt = Date.now();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isIndexing = false;
    }
  }

  function openThread(result: SearchResult) {
    const layout = clientState.currentSpaceState?.layout;
    if (!layout) return;

    layout.openChatTab(result.threadId, result.title ?? "New chat");
    clientState.layout.swins.clear();
  }

  function formatDate(value?: number): string {
    if (!value) return "";
    const date = new Date(value);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center gap-3">
    <div class="flex-1">
      <label class="sr-only" for="chat-search">Search chats</label>
      <div class="relative">
        <input
          id="chat-search"
          class="input w-full pl-10"
          type="text"
          placeholder="Search chats"
          bind:value={query}
        />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">
          <Search size={16} />
        </span>
      </div>
    </div>
    <button
      class="btn btn-sm preset-tonal"
      type="button"
      onclick={buildIndex}
      disabled={isIndexing}
    >
      <RefreshCcw size={16} />
      {isIndexing ? "Indexing" : "Rebuild"}
    </button>
  </div>

  {#if error}
    <div class="text-sm text-error-500">{error}</div>
  {/if}

  {#if lastIndexedAt}
    <p class="text-xs text-surface-500">
      Last indexed {formatDate(lastIndexedAt)}
    </p>
  {/if}

  <div class="flex flex-col gap-2">
    {#if query.trim().length === 0}
      <p class="text-sm text-surface-500">
        Type to search thread titles and messages.
      </p>
    {:else if isIndexing}
      <p class="text-sm text-surface-500">Indexing chats…</p>
    {:else if results.length === 0}
      <p class="text-sm text-surface-500">No results.</p>
    {:else}
      <ul class="space-y-2">
        {#each results as result (result.threadId)}
          <li>
            <button
              class="w-full text-left rounded border border-surface-200-800 p-3 hover:bg-surface-100-900/50"
              type="button"
              onclick={() => openThread(result)}
            >
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-medium truncate">{result.title}</p>
                {#if result.updatedAt}
                  <span class="text-xs text-surface-500">
                    {formatDate(result.updatedAt)}
                  </span>
                {/if}
              </div>
              <p class="text-xs text-surface-500 mt-1 line-clamp-2">
                {result.snippet}
              </p>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
