<script lang="ts">
  import { onMount, tick } from "svelte";
  import { ClientState, SilaApp } from "@sila/client";
  import type { TTabs } from "ttabs-svelte";
  import { loadDemoSpace } from "$lib/loadDemoSpace";

  const TARGET_THREAD_NAME = "Pumpkin Latte Sales";
  const THREAD_POLL_ATTEMPTS = 30;
  const LAYOUT_POLL_ATTEMPTS = 120;
  const POLL_INTERVAL_MS = 50;

  let loading = $state(true);
  let error: string | null = $state(null);
  let localState: ClientState | null = $state(null);

  async function waitForThreadId(state: ClientState): Promise<string> {
    const space = state.currentSpace;
    if (!space) {
      throw new Error("Space is not ready");
    }

    for (let i = 0; i < THREAD_POLL_ATTEMPTS; i += 1) {
      const threadVertex = space.appTreesVertex.children.find((vertex) => {
        const name = vertex.name ?? (vertex.getProperty("name") as string | undefined);
        return name === TARGET_THREAD_NAME;
      });
      const treeId = threadVertex?.getProperty("tid");
      if (typeof treeId === "string") return treeId;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(`Thread not found: ${TARGET_THREAD_NAME}`);
  }

  function findLayoutRefs(ttabs: TTabs): { sidebarColumn: string; contentGrid?: string } | null {
    const tiles = ttabs.getTiles();
    const sidebarTile = Object.values(tiles).find(
      (tile) => tile.type === "content" && tile.componentId === "sidebar"
    );
    if (!sidebarTile?.parent) return null;

    const sidebarColumn = sidebarTile.parent;
    const sidebarParent = tiles[sidebarColumn]?.parent;
    if (!sidebarParent) return { sidebarColumn };

    const row = tiles[sidebarParent];
    if (!row || row.type !== "row") return { sidebarColumn };

    const otherColumns = row.columns.filter((colId) => colId !== sidebarColumn);
    if (otherColumns.length === 0) return { sidebarColumn };

    const contentColumn = tiles[otherColumns[0]];
    if (!contentColumn || contentColumn.type !== "column" || !contentColumn.child) {
      return { sidebarColumn };
    }

    const childTile = tiles[contentColumn.child];
    if (!childTile || childTile.type !== "grid") return { sidebarColumn };

    return { sidebarColumn, contentGrid: childTile.id };
  }

  async function waitForLayoutRefs(state: ClientState): Promise<{
    sidebarColumn: string;
    contentGrid?: string;
  }> {
    const layout = state.currentSpaceState?.layout;
    if (!layout) {
      throw new Error("Layout is not ready");
    }

    for (let i = 0; i < LAYOUT_POLL_ATTEMPTS; i += 1) {
      const refs = findLayoutRefs(layout.ttabs);
      if (refs) return refs;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error("Layout did not initialize");
  }

  onMount(async () => {
    try {
      const { state } = await loadDemoSpace({ configUrl: "/api/demo-space" });
      localState = state;
      await tick();
      loading = false;

      const treeId = await waitForThreadId(state);
      const refs = await waitForLayoutRefs(state);
      const layout = state.currentSpaceState?.layout;
      if (!layout) {
        throw new Error("Layout is not ready");
      }

      layout.layoutRefs.sidebarColumn = refs.sidebarColumn;
      if (refs.contentGrid) {
        layout.layoutRefs.contentGrid = refs.contentGrid;
      }

      layout.sidebar.widthWhenOpen = Math.max(300, layout.sidebar.widthWhenOpen);
      layout.sidebar.open();
      layout.openChatTab(treeId, TARGET_THREAD_NAME);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      loading = false;
    }
  });
</script>

{#if error}
  <div>Error: {error}</div>
{:else if loading}
  <div>Loading demo space...</div>
{:else if localState}
  <SilaApp config={{}} state={localState} />
{:else}
  <div>Demo space not loaded</div>
{/if}
