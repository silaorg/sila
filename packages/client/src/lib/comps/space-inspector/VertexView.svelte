<script lang="ts">
  import type { Vertex } from "@sila/core";
  import Self from "./VertexView.svelte";
  import VertexPropertiesView from "./VertexPropertiesView.svelte";
  import { TrashIcon, Plus } from "lucide-svelte";
  import { i18n } from "@sila/client";
  
  let { vertex, onTreeOpen }: { vertex: Vertex, onTreeOpen: (treeId: string) => void } = $props();
  let children = $state<Vertex[]>([]);
  let isExpanded = $state(false);

  function updateVertex() {
    children = vertex.children;
  }

  function toggleExpand() {
    isExpanded = !isExpanded;
  }

  function createNewVertex() {
    vertex.newChild();
    isExpanded = true;
  }

  function deleteVertex() {
    vertex.delete();
  }

  $effect(() => {
    updateVertex();

    const unobserve = vertex.observe((events) => {
      if (events.some((e) => e.type === "children")) {
        updateVertex();
      }
    });
    return () => unobserve();
  });
</script>

<div class="vertex-item min-w-[400px]" class:ml-4={vertex.parentId !== null}>
  <div class="vertex-header flex items-center gap-2 py-2">
    <span class="vertex-name font-medium flex-1">
      {vertex.name ?? vertex.id}
    </span>
    {#if vertex.parentId !== null}
      <button
        class="btn-icon btn-icon-sm hover:variant-soft"
        onclick={deleteVertex}
        aria-label={i18n.texts.spaceInspector.deleteVertexAria}
      >
        <TrashIcon size={14} />
      </button>
    {/if}
  </div>

  <div class="vertex-content text-xs">
    <VertexPropertiesView {vertex} onTreeOpen={onTreeOpen} />

    <div class="property-item flex items-center gap-2 p-2 hover:bg-surface-500/10">
      <button
        class="vertex-summary-symbol fill-current w-5 h-5 text-center transition-transform duration-[200ms] hover:variant-soft rounded-container-token p-1 -ml-1 flex items-center justify-center"
        class:rotate-180={isExpanded}
        onclick={toggleExpand}
        aria-expanded={isExpanded}
        aria-label={i18n.texts.spaceInspector.toggleExpandAria}
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="w-3 h-3">
          <path
            d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"
          ></path>
        </svg>
      </button>
      <span class="property-key opacity-75">
        {i18n.texts.spaceInspector.childrenLabel}
      </span>
      <span class="property-value font-mono">[{children.length}]</span>
      <div class="flex-1"></div>
      <button
        class="btn-icon btn-icon-sm hover:variant-soft"
        onclick={createNewVertex}
        aria-label={i18n.texts.spaceInspector.addVertexAria}
      >
        <Plus size={14} />
      </button>
    </div>

    {#if isExpanded && children.length > 0}
      <div class="vertex-item-children mt-2 pl-[11px] relative" role="group">
        <div class="absolute left-[9px] top-0 bottom-0 border-l border-surface-500/20"></div>
        {#each children as child (child.id)}
          <Self vertex={child} onTreeOpen={onTreeOpen} />
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .vertex-summary-symbol {
    cursor: pointer;
  }
</style>
