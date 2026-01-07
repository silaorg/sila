<script lang="ts">
  import { TTabsRoot } from "ttabs-svelte";
  import { getTtabsLayout, saveTtabsLayout } from "@sila/client/localDb";
  import { onDestroy, untrack } from "svelte";
  import type { SpaceState } from "@sila/client/state/spaceState.svelte";

  let { spaceState }: { spaceState: SpaceState } = $props();

  let unsubscribe: (() => void) | null = null;
  let lastSavedLayout: string | null = null;

  async function saveSpaceLayout(): Promise<void> {
    if (!spaceState.space) return;

    const layoutJson = spaceState.layout.ttabs.serializeLayout();

    // Only save if the layout has changed
    if (layoutJson !== lastSavedLayout) {
      lastSavedLayout = layoutJson;

      // Save to database
      await saveTtabsLayout(spaceState.pointer.uri, layoutJson);
    }
  }

  function subscribeToTtabs(): void {
    if (unsubscribe) {
      unsubscribe();
    }

    unsubscribe = spaceState.layout.ttabs.subscribe(() => {
      saveSpaceLayout();
    });
  }

  $effect(() => {
    const spaceUri = spaceState.pointer.uri ?? null;

    untrack(() => {
      setupSpaceLayout(spaceUri);
    });
  });

  async function setupSpaceLayout(spaceUri: string | null): Promise<void> {
    if (!spaceUri) {
      spaceState.layout.ttabs.resetTiles();
      return;
    }

    try {
      const ttabsLayout = await getTtabsLayout(spaceUri);
      spaceState.layout.setupLayout(ttabsLayout ?? undefined);
      lastSavedLayout = ttabsLayout ?? null;
    } catch (error) {
      spaceState.layout.setupLayout();
    }

    subscribeToTtabs();
  }

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<TTabsRoot ttabs={spaceState.layout.ttabs} />
