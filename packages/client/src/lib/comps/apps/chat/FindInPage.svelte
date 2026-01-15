<script lang="ts">
  import { onMount, tick } from "svelte";
  import { ChevronDown, ChevronUp, X } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import {
    clearActivePageSearchMatch,
    clearPageSearchHighlights,
    highlightPageSearchMatches,
    setActivePageSearchMatch,
    type PageSearchController,
    type PageSearchMatch,
  } from "@sila/client/utils/pageSearch";

  let {
    containerEl,
    enabled,
    contentVersion,
  }: {
    containerEl: HTMLElement | null;
    enabled: boolean;
    contentVersion: unknown;
  } = $props();

  const clientState = useClientState();

  let pageSearchOpen = $state(false);
  let pageSearchQuery = $state("");
  let pageSearchMatches = $state<PageSearchMatch[]>([]);
  let pageSearchActiveIndex = $state(0);
  let pageSearchActiveMatch = $state<PageSearchMatch | null>(null);
  let pageSearchInputEl = $state<HTMLInputElement | null>(null);
  let pageSearchTimer: number | null = $state(null);

  let pageSearchTotal = $derived(pageSearchMatches.length);
  let pageSearchIndex = $derived(pageSearchTotal > 0 ? pageSearchActiveIndex + 1 : 0);

  $effect(() => {
    if (!pageSearchOpen) return;
    contentVersion;
    if (!containerEl) return;
    tick().then(() => {
      schedulePageSearch();
    });
  });

  $effect(() => {
    if (!enabled && pageSearchOpen) {
      closePageSearch();
    }
  });

  $effect(() => {
    if (!pageSearchOpen && containerEl) {
      clearPageSearchHighlights(containerEl);
      pageSearchMatches = [];
      pageSearchActiveIndex = 0;
      pageSearchActiveMatch = null;
    }
  });

  function schedulePageSearch() {
    if (!pageSearchOpen) return;
    if (!containerEl) return;
    if (pageSearchTimer) {
      window.clearTimeout(pageSearchTimer);
    }
    pageSearchTimer = window.setTimeout(() => {
      pageSearchTimer = null;
      applyPageSearch();
    }, 50);
  }

  function applyPageSearch() {
    if (!containerEl) return;
    const result = highlightPageSearchMatches(containerEl, pageSearchQuery, 1000);
    pageSearchMatches = result.matches;
    if (pageSearchMatches.length === 0) {
      clearActivePageSearchMatch(pageSearchActiveMatch);
      pageSearchActiveMatch = null;
      pageSearchActiveIndex = 0;
      return;
    }
    const nextIndex = Math.min(pageSearchActiveIndex, pageSearchMatches.length - 1);
    setActivePageSearchIndex(nextIndex);
  }

  function setActivePageSearchIndex(index: number) {
    if (pageSearchMatches.length === 0) return;
    clearActivePageSearchMatch(pageSearchActiveMatch);
    pageSearchActiveIndex =
      ((index % pageSearchMatches.length) + pageSearchMatches.length) %
      pageSearchMatches.length;
    const nextMatch = pageSearchMatches[pageSearchActiveIndex] ?? null;
    pageSearchActiveMatch = nextMatch;
    setActivePageSearchMatch(nextMatch);
  }

  function goToNextMatch() {
    if (pageSearchMatches.length === 0) return;
    setActivePageSearchIndex(pageSearchActiveIndex + 1);
  }

  function goToPrevMatch() {
    if (pageSearchMatches.length === 0) return;
    setActivePageSearchIndex(pageSearchActiveIndex - 1);
  }

  function openPageSearch() {
    if (!enabled) return;
    pageSearchOpen = true;
    tick().then(() => {
      pageSearchInputEl?.focus();
      pageSearchInputEl?.select();
      schedulePageSearch();
    });
  }

  function closePageSearch() {
    pageSearchOpen = false;
    pageSearchQuery = "";
  }

  function togglePageSearch() {
    if (pageSearchOpen) {
      closePageSearch();
    } else {
      openPageSearch();
    }
  }

  function handlePageSearchInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    pageSearchQuery = target?.value ?? "";
    pageSearchActiveIndex = 0;
    schedulePageSearch();
  }

  function handlePageSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePageSearch();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    }
  }

  const pageSearchController: PageSearchController = {
    open: openPageSearch,
    close: closePageSearch,
    toggle: togglePageSearch,
    setQuery: (value: string) => {
      pageSearchQuery = value;
      pageSearchActiveIndex = 0;
      schedulePageSearch();
    },
    next: goToNextMatch,
    prev: goToPrevMatch,
  };

  onMount(() => {
    clientState.pageSearchController = pageSearchController;

    return () => {
      if (clientState.pageSearchController === pageSearchController) {
        clientState.pageSearchController = null;
      }
      if (pageSearchTimer) {
        window.clearTimeout(pageSearchTimer);
      }
      if (containerEl) {
        clearPageSearchHighlights(containerEl);
      }
    };
  });
</script>

{#if pageSearchOpen}
  <div
    class="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-xl border border-surface-200-800 bg-surface-50-950 px-3 py-2 shadow"
    data-testid="chat-page-search"
  >
    <input
      class="input h-8 min-w-[200px] bg-transparent px-2"
      placeholder="Find in chat"
      aria-label="Find in chat"
      bind:this={pageSearchInputEl}
      value={pageSearchQuery}
      oninput={handlePageSearchInput}
      onkeydown={handlePageSearchKeydown}
      data-testid="chat-page-search-input"
    />
    <span class="text-xs text-surface-500" data-testid="chat-page-search-count">
      {pageSearchIndex}/{pageSearchTotal}
    </span>
    <div class="flex items-center">
      <button
        class="btn-icon"
        type="button"
        aria-label="Find previous"
        onclick={goToPrevMatch}
      >
        <ChevronUp size={16} />
      </button>
      <button
        class="btn-icon"
        type="button"
        aria-label="Find next"
        onclick={goToNextMatch}
      >
        <ChevronDown size={16} />
      </button>
    </div>
    <button
      class="btn-icon"
      type="button"
      aria-label="Close find bar"
      onclick={closePageSearch}
    >
      <X size={16} />
    </button>
  </div>
{/if}
