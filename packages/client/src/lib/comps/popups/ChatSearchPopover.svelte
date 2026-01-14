<script lang="ts">
  import { onDestroy } from "svelte";
  import { MessageCircle, Search, X } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { closeStack } from "@sila/client/utils/closeStack";
  import {
    buildChatSearchEntries,
    queryChatSearch,
    type SearchResult,
    type SearchThreadEntry,
  } from "@sila/client/utils/chatSearch";

  const clientState = useClientState();

  let open = $state(false);
  let query = $state("");
  let entries = $state<SearchThreadEntry[]>([]);
  let isIndexing = $state(false);
  let error = $state<string | null>(null);
  let activeIndex = $state(0);
  let popoverElement: HTMLDivElement | null = null;
  let inputElement: HTMLInputElement | null = null;

  const recentWindowMs = 7 * 24 * 60 * 60 * 1000;
  const recentLimit = 8;

  let results = $state<SearchResult[]>([]);

  const trimmedQuery = $derived(query.trim());
  const hasQuery = $derived(trimmedQuery.length > 0);

  const recentThreads = $derived.by(() => {
    const cutoff = Date.now() - recentWindowMs;
    const sorted = [...entries].sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    );
    const withinWeek = sorted.filter((entry) => (entry.updatedAt ?? 0) >= cutoff);
    return (withinWeek.length > 0 ? withinWeek : sorted).slice(0, recentLimit);
  });

  const visibleItems = $derived.by(() =>
    hasQuery ? results : recentThreads
  );

  $effect(() => {
    if (!open) return;
    void buildIndex();
  });

  $effect(() => {
    if (!open) {
      results = [];
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      results = [];
      return;
    }
    const currentSpace = clientState.currentSpace;
    if (!currentSpace) {
      results = [];
      return;
    }

    const currentEntries = entries;
    error = null;
    let cancelled = false;
    void (async () => {
      try {
        const nextResults = await queryChatSearch(
          currentSpace,
          currentEntries,
          trimmed,
        );
        if (!cancelled) {
          results = nextResults;
        }
      } catch (err) {
        if (!cancelled) {
          error = err instanceof Error ? err.message : String(err);
          results = [];
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (!popoverElement || typeof document === "undefined") return;
    if (popoverElement.parentElement !== document.body) {
      document.body.appendChild(popoverElement);
    }
  });

  $effect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputElement?.focus());
  });

  onDestroy(() => {
    if (!popoverElement || typeof document === "undefined") return;
    if (popoverElement.parentElement === document.body) {
      document.body.removeChild(popoverElement);
    }
  });

  $effect(() => {
    if (!open) {
      activeIndex = 0;
      return;
    }
    query;
    if (visibleItems.length === 0) {
      activeIndex = 0;
      return;
    }
    if (activeIndex >= visibleItems.length) {
      activeIndex = 0;
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

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePopover();
      return;
    }
    if (!open || visibleItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % visibleItems.length;
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex =
        (activeIndex - 1 + visibleItems.length) % visibleItems.length;
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = visibleItems[activeIndex];
      if (selected) {
        openThread(selected);
      }
    }
  }
</script>

<button
  type="button"
  class="p-2 rounded hover:preset-tonal"
  data-role="open-search"
  aria-label="Search chats"
  onclick={() => (open = !open)}
>
  <Search size={18} />
</button>

<div
  bind:this={popoverElement}
  class="fixed inset-0 z-49 flex flex-col items-center p-4 pt-20 pb-20 overflow-y-auto"
  class:hidden={!open}
  data-popover-content
  data-state={open ? "open" : "closed"}
  role="dialog"
  aria-hidden={!open}
  onkeydown={handleKeydown}
  use:closeStack={() => {
    if (!open) return false;
    closePopover();
    return true;
  }}
>
  <div
    class="absolute left-0 top-0 w-full h-full cursor-auto bg-surface-50/80 dark:bg-surface-950/80 transition-opacity"
    onclick={closePopover}
  ></div>
  <div class="relative card selectable-text rounded-lg bg-surface-50-950 border-1 border-surface-200-800 shadow-2xl w-[520px] flex flex-col overflow-hidden max-h-[calc(100vh-10rem)]">
    <div class="flex items-center gap-2 border-b border-surface-200-800 px-3 py-2.5">
      <div class="relative flex-1">
        <input
          class="input w-full pl-10 pr-3 py-2 text-base border-0 rounded-xl outline-none ring-0 ring-offset-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:shadow-none focus-visible:shadow-none"
          type="text"
          placeholder="Search chats..."
          bind:value={query}
          bind:this={inputElement}
          onkeydown={handleKeydown}
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

      {#if !hasQuery}
        <div class="space-y-3">
          <p class="text-xs uppercase tracking-wide text-surface-500">Previous 7 days</p>
          {#if recentThreads.length === 0}
            <p class="text-sm text-surface-500">No recent conversations.</p>
          {:else}
            <ul class="space-y-1" role="listbox">
              {#each recentThreads as entry, index (entry.threadId)}
                {@const isActive = index === activeIndex}
                <li>
                  <button
                    type="button"
                    class={`w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-100-900/50 ${isActive ? "bg-surface-100-900/60" : ""}`}
                    onclick={() => openThread(entry)}
                    onmouseenter={() => (activeIndex = index)}
                    role="option"
                    aria-selected={isActive}
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
        <ul class="space-y-1" role="listbox">
          {#each results as result, index (result.threadId)}
            {@const isActive = index === activeIndex}
            <li>
              <button
                type="button"
                class={`w-full flex flex-col gap-1 rounded-xl px-3 py-2 hover:bg-surface-100-900/50 ${isActive ? "bg-surface-100-900/60" : ""}`}
                onclick={() => openThread(result)}
                onmouseenter={() => (activeIndex = index)}
                role="option"
                aria-selected={isActive}
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
  </div>
</div>
