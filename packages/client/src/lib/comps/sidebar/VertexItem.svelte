<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { VertexChangeEvent } from "@sila/core";
  const clientState = useClientState();
  import { onMount, tick } from "svelte";
  import AppTreeOptionsPopup from "../popups/AppTreeOptionsPopup.svelte";

  let { id }: { id: string } = $props();

  let appTreeId = $state<string | undefined>(undefined);
  let name = $state<string | undefined>(undefined);
  let appId = $state<string | undefined>(undefined);
  let isEditing = $state(false);
  let draftName = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);

  let ttabs = $derived(clientState.currentSpaceState?.layout.ttabs);

  // Track if this vertex item has an open tab
  let isOpen = $derived.by(() => {
    if (!ttabs) return false;

    // A little hack to force the effect to run when ttabs changes
    const _ = ttabs.tiles;
    if (!appTreeId) return false;

    const tabId = findTabByTreeId(appTreeId);

    return tabId !== undefined;
  });

  let isActive = $derived.by(() => {
    if (!isOpen || !ttabs) return false;

    const tabId = findTabByTreeId(appTreeId!);
    return tabId === ttabs.focusedActiveTab;
  });

  // @TODO: consider having an array of open tabs in ttabs so it's cheaper to check
  // Find a tab with a specific treeId
  function findTabByTreeId(treeId: string): string | undefined {
    if (!ttabs) return undefined;

    // Search through all tab tiles
    for (const tileId in ttabs.tiles) {
      const tile = ttabs.tiles[tileId];
      if (tile.type === "tab") {
        const content = ttabs.getTabContent(tile.id);
        if (
          (content?.componentId === "chat" || content?.componentId === "files") &&
          content?.data?.componentProps?.treeId === treeId
        ) {
          return tile.id;
        }
      }
    }
    return undefined;
  }

  onMount(() => {
    const vertex = clientState.currentSpace?.getVertex(id);
    appTreeId = vertex?.getProperty("tid") as string | undefined;
    name = vertex?.name
    
    // Load the app tree to get the appId
    if (appTreeId) {
      loadAppTreeInfo();
    }
  });

  async function loadAppTreeInfo() {
    if (!appTreeId) return;
    
    try {
      const appTree = await clientState.currentSpace?.loadAppTree(appTreeId);
      if (appTree) {
        appId = appTree.getAppId();
        // Use the name from the app tree if available
        const appTreeName = appTree.tree.root?.getProperty("name") as string;
        if (appTreeName) {
          name = appTreeName;
        }
      }
    } catch (error) {
      console.warn("Failed to load app tree info:", error);
    }
  }

  $effect(() => {
    const unobserve = clientState.currentSpace?.tree.observe(id, onSpaceChange);
    return () => {
      unobserve?.();
    };
  });

  function onSpaceChange(events: VertexChangeEvent[]) {
    if (!ttabs) return;

    if (events.some((e) => e.type === "property")) {
      if (isEditing) return;
      const vertex = clientState.currentSpace?.getVertex(id);
      name = vertex?.name;

      // Update any open tab for this conversation with the new name
      if (appTreeId) {
        const tabId = findTabByTreeId(appTreeId);
        if (tabId) {
          ttabs.updateTile(tabId, { name: name ?? "New chat" });
        }
      }
    }
  }

  function openApp() {
    const layout = clientState.currentSpaceState?.layout;

    if (appTreeId && layout) {
      if (appId === "files") {
        layout.openFilesTab(appTreeId, name ?? "Files");
      } else {
        layout.openChatTab(appTreeId, name ?? "New chat");
      }
    }
  }

  async function startEditing() {
    if (isEditing) return;

    isEditing = true;
    draftName = name ?? "New chat";
    await tick();
    inputEl?.focus();
    inputEl?.select();
  }

  function commitEditing() {
    const nextName = draftName.trim();

    if (nextName === name) {
      isEditing = false;
      return;
    }

    if (nextName && appTreeId) {
      clientState.currentSpace?.setAppTreeName(appTreeId, nextName);
    }
    name = nextName || name || "New chat";
    if (appTreeId && ttabs) {
      const tabId = findTabByTreeId(appTreeId);
      if (tabId) {
        ttabs.updateTile(tabId, { name });
      }
    }
    isEditing = false;
  }

  function cancelEditing() {
    isEditing = false;
    draftName = name ?? "New chat";
  }

  function handleEditorKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEditing();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }
</script>

{#if appTreeId}
  <span
    class={`flex rounded text-sm
      ${isOpen && !isActive ? "bg-surface-100-900/50" : ""} 
      ${isActive ? "bg-surface-100-900" : ""} 
      ${!isOpen ? "hover:bg-surface-100-900/50" : ""}`}
  >
    <button
      class="flex-grow truncate text-left ph-no-capture py-1 px-2"
      data-role="open-conversation"
      onclick={openApp}
      ondblclick={startEditing}
    >
      {#if isEditing}
        <input
          class="w-full h-full bg-transparent outline-none text-sm leading-5 py-0 px-0"
          bind:value={draftName}
          bind:this={inputEl}
          onkeydown={handleEditorKeydown}
          onblur={commitEditing}
        />
      {:else}
        <span>{name ?? "New chat"}</span>
      {/if}
    </button>
    {#if isActive}
      <AppTreeOptionsPopup {appTreeId} onRename={startEditing} />
    {/if}
  </span>
{/if}
