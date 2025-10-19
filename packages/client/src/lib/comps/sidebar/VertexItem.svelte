<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { VertexChangeEvent } from "@sila/core";
  const clientState = useClientState();
  import { onMount } from "svelte";
  import AppTreeOptionsPopup from "../popups/AppTreeOptionsPopup.svelte";

  let { id }: { id: string } = $props();

  let appTreeId = $state<string | undefined>(undefined);
  let name = $state<string | undefined>(undefined);
  let appId = $state<string | undefined>(undefined);

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
</script>

{#if appTreeId}
  <span
    class={`flex rounded text-sm
      ${isOpen && !isActive ? "preset-tonal-secondary" : ""} 
      ${isActive ? "preset-filled-primary-500" : ""} 
      ${!isOpen ? "hover:preset-tonal" : ""}`}
  >
    <button class="flex-grow py-1 px-2 truncate text-left" onclick={openApp}>
      <span>{name ?? "New chat"}</span>
    </button>
    {#if isActive}
      <AppTreeOptionsPopup {appTreeId} />
    {/if}
  </span>
{/if}
