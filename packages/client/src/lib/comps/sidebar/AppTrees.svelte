<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import VertexItem from "./VertexItem.svelte";
  import type { VertexChangeEvent } from "reptree";

  let appTreeIds: string[] = $state([]);
  let appTreesUnobserve: (() => void) | undefined;

  $effect(() => {
    if (clientState.currentSpace) {
      appTreeIds = [...(clientState.currentSpace.getAppTreeIds() ?? [])];
      appTreesUnobserve = clientState.currentSpace.tree.observe(
        clientState.currentSpace.appTreesVertex.id,
        onAppTreeChange
      );
    } else {
      appTreeIds = [];
    }

    return () => {
      appTreesUnobserve?.();
    };
  });

  function onAppTreeChange(events: VertexChangeEvent[]) {
    if (events.some((e) => e.type === "children")) {
      appTreeIds = [...(clientState.currentSpace?.getAppTreeIds() ?? [])];
    }
  }
</script>

<ul class="space-y-1">
  {#each [...appTreeIds].reverse() as id (id)}
    <li class="relative"><VertexItem {id} /></li>
  {/each}
</ul>
