<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import VertexView from "./VertexView.svelte";
  const clientState = useClientState();
  import type { Vertex } from "@sila/core";

  let spaceRootVertex = $derived(clientState.currentSpace?.rootVertex);
  let appTreeRootVertex = $state<Vertex | undefined>(undefined);
  let showingAppTree = $state(false);

  let ttabs = $derived(clientState.currentSpaceState?.layout.ttabs);

  let currentTreeId = $derived.by(() => {
    if (!ttabs) return undefined;

    const panel = ttabs.getActivePanelTile();
    if (panel?.activeTab) {
      const content = ttabs.getTabContent(panel.activeTab);
      return content?.data?.componentProps?.treeId;
    }
    return undefined;
  });

  async function onTreeOpen(treeId: string) {
    const appTree = await clientState.currentSpace?.loadAppTree(treeId);
    if (appTree) {
      appTreeRootVertex = appTree.tree.root;
      showingAppTree = true;
    }
  }

  function showSpace() {
    showingAppTree = false;
  }
</script>

<ol class="flex items-center gap-4 mb-4 text-sm">
  <li>
    <button
      class="opacity-60 hover:underline"
      onclick={showSpace}
      disabled={!showingAppTree}
    >
      Space
    </button>
  </li>
  {#if currentTreeId && !showingAppTree}
    <li class="opacity-50" aria-hidden="true">&rsaquo;</li>
    <li>
      <button
        class="text-blue-500 hover:underline font-medium"
        onclick={() => onTreeOpen(currentTreeId)}
      >
        Open Current App Tree
      </button>
    </li>
  {/if}
  {#if showingAppTree}
    <li class="opacity-50" aria-hidden="true">&rsaquo;</li>
    <li>App Tree</li>
  {/if}
</ol>

{#if spaceRootVertex}
  <div class="space-tree" class:hidden={showingAppTree}>
    <VertexView vertex={spaceRootVertex} {onTreeOpen} />
  </div>

  {#if appTreeRootVertex}
    <div class="app-tree" class:hidden={!showingAppTree}>
      <VertexView vertex={appTreeRootVertex} {onTreeOpen} />
    </div>
  {/if}
{/if}
