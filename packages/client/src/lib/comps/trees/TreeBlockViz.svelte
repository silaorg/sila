<script lang="ts">
  import { onMount} from "svelte";
  import { type Writable, get } from "svelte/store";
  import type { RepTree, Vertex } from "@sila/core";
  import {
    type VertexChangeEvent,
    type TreeVertexProperty,
  } from "@sila/core";

  export let tree: RepTree;
  export let vertexId: string;
  export let treeStores: {
    dragStartVertexIdStore: Writable<string | undefined>;
    dragOverVertexIdStore: Writable<string | null | undefined>;
  };

  let children: string[] = [];
  let properties: ReadonlyArray<TreeVertexProperty> = [];
  let vertexName: string | null = null;
  let isRoot: boolean;
  let isExpanded = false;
  let highlightAsDragOver = false;

  // TODO: detect illigal moves and show it (or at least don't higlight the vertex when it's not allowed to move a vertex in)

  treeStores.dragOverVertexIdStore.subscribe((id) => {
    highlightAsDragOver = vertexId === id;
  });

  function updateChildren() {
    children = tree.getChildrenIds(vertexId);

    if (vertexId) {
      properties = tree.getVertexProperties(vertexId);
      vertexName = properties.find((p) => p.key === "name")?.value as
        | string
        | null;
    }
  }

  function handleTreeChange(events: VertexChangeEvent[]) {
    if (events.some(e => e.type === "property")) {
      console.log("property change", events);
    } else if (events.some(e => e.type === "children")) {
      console.log("children change", events);
    } else if (events.some(e => e.type === "move")) {
      console.log("move change", event);
    }

    /*
    // Update the children if the vertex has updated or one of its children has updated
    if (event.vertexId === vertexId) {
      updateChildren();
    }
    */

    console.log("handleTreeChange", events);

    updateChildren();
  }

  onMount(() => {
    isRoot = vertexId === tree.rootVertexId;
    updateChildren();
    const unobserve = tree.observe(vertexId, handleTreeChange);
    return () => unobserve();
  });

  function toggleExpand() {
    isExpanded = !isExpanded;
  }

  function handleDragStart(event: DragEvent) {
    if (!vertexId) {
      return;
    }

    event.stopPropagation();
    treeStores.dragStartVertexIdStore.set(vertexId);
    console.log(
      `Started dragging vertex: ${get(treeStores.dragStartVertexIdStore)}`,
    );
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    treeStores.dragOverVertexIdStore.set(vertexId);
  }

  function handleDragLeave() {
    treeStores.dragOverVertexIdStore.set(null);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    let draggedVertexId = get(treeStores.dragStartVertexIdStore);

    /*
    console.log(
      `Drop event triggered. draggedVertexId: ${draggedVertexId}, targetId: ${vertexId}`,
    );
    */

    if (!draggedVertexId) {
      //console.log("Drop action invalid: draggedVertexId is null");
    } else if (draggedVertexId === vertexId) {
      /*
      console.log(
        `Dropped vertex ${draggedVertexId} onto itself - no action taken`,
      );
      */
    } else {
      /*
      console.log(
        `Attempting to move vertex ${draggedVertexId} to ${vertexId}`,
      );
      */
      try {
        tree.moveVertex(draggedVertexId, vertexId);
        isExpanded = true;
      } catch (error) {
        console.error("Error during tree.move:", error);
      }
    }

    treeStores.dragStartVertexIdStore.set(undefined);
    treeStores.dragOverVertexIdStore.set(undefined);
  }
</script>

<div
  class="tree-item"
  class:ml-4={!isRoot}
  class:drag-over={highlightAsDragOver}
  draggable="true"
  role="treeitem"
  tabindex="0"
  aria-selected="false"
  on:dragstart={(e) => handleDragStart(e)}
  on:dragover={(e) => handleDragOver(e)}
  on:dragleave={handleDragLeave}
  on:drop={(e) => handleDrop(e)}
>
  <button
    class="tree-item-summary w-full text-left list-none flex items-center cursor-pointer space-x-4 rounded-container-token py-4 px-4 hover:variant-soft"
    on:click={toggleExpand}
    aria-expanded={isExpanded}
    type="button"
  >
    <div
      class="tree-summary-symbol fill-current w-3 text-center transition-transform duration-[200ms]"
      class:rotate-180={isExpanded}
    >
      {#if children.length > 0}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
          <path
            d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"
          ></path>
        </svg>
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 448 512"
          class="w-3 opacity-10"
        >
          <path
            d="M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z"
          ></path>
        </svg>
      {/if}
    </div>
    <div class="tree-item-content">
      <span>
        {#if vertexName}
          {vertexName}
        {:else}
          {vertexId ?? "root"}
        {/if}
      </span>
      <ul class="text-xs">
        {#each properties as property (property.key)}
          <li>{property.key}: {property.value}</li>
        {/each}
      </ul>
    </div>
  </button>

  {#if isExpanded && children.length > 0}
    <div class="tree-item-children ml-4" role="group">
      {#each children as child (child)}
        <svelte:self {tree} vertexId={child} {treeStores} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .drag-over {
    background-color: rgba(0, 0, 255, 0.1);
    outline: 2px solid blue;
  }
</style>
