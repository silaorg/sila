<script lang="ts">
  import type { Vertex } from "@sila/core";
  import type { VertexPropertyType } from "@sila/core";
  import { TrashIcon, Plus } from "lucide-svelte";
  import NewPropertyForm from "./NewPropertyForm.svelte";
  import { i18n } from "@sila/client";
  
  let { vertex, onTreeOpen }: { vertex: Vertex, onTreeOpen: (treeId: string) => void } = $props();
  let properties = $state<Record<string, any>>({});
  let isAddingProperty = $state(false);

  function formatPropertyKey(key: string): string {
    if (key === '_c') return i18n.texts.spaceInspector.createdAtLabel;
    if (key === 'tid') return i18n.texts.spaceInspector.appTreePropertyLabel;
    return key;
  }

  function formatPropertyValue(key: string, value: any): string {
    if (key === '_c') {
      try {
        const date = new Date(value);
        return date.toLocaleString();
      } catch {
        return value;
      }
    }
    return value;
  }

  async function openAppTree(treeId: string) {
    onTreeOpen(treeId);
  }

  function updateProperties() {
    const allProps = vertex.getProperties();
    // Filter out the _n property
    const { _n, ...filteredProps } = allProps;
    properties = filteredProps;
  }

  function updateProperty(key: string, value: VertexPropertyType) {
    vertex.setProperty(key, value);
  }

  function getPropertyType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'other' {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) return 'array';
      return 'object';
    }
    return 'other';
  }

  function handleStringChange(key: string, event: Event) {
    const input = event.target as HTMLInputElement;
    vertex.setTransientProperty(key, input.value);
  }

  function handleStringBlur(key: string, event: Event) {
    const input = event.target as HTMLInputElement;
    vertex.setProperty(key, input.value);
  }

  function handleNumberChange(key: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value)) {
      updateProperty(key, value);
    }
  }

  function handleBooleanChange(key: string, event: Event) {
    const input = event.target as HTMLInputElement;
    updateProperty(key, input.checked);
  }

  function deleteProperty(key: string) {
    vertex.setProperty(key, undefined);
  }

  $effect(() => {
    updateProperties();
  });

  vertex.observe((events) => {
    if (events.some((e) => e.type === "property")) {
      updateProperties();
    }
  });
</script>

<div class="properties-section">
  {#each Object.entries(properties).sort(([a], [b]) => {
    // Keep _c at the top
    if (a === '_c') return -1;
    if (b === '_c') return 1;
    // Keep tid second
    if (a === 'tid') return -1;
    if (b === 'tid') return 1;
    // Sort rest alphabetically
    return a.localeCompare(b);
  }) as [key, value] (key)}
    <div class="property-item flex items-center gap-2 p-2 hover:bg-surface-500/10">
      <span class="property-key opacity-75 min-w-[80px] shrink-0">{formatPropertyKey(key)}:</span>
      <div class="flex-1 flex">
        {#if key === 'tid'}
          <button 
            class="px-2 py-0.5 btn-sm hover:variant-soft text-xs"
            onclick={() => openAppTree(value)}
          >
            open
          </button>
        {:else if key === '_c'}
          <span class="property-value font-mono text-xs">{formatPropertyValue(key, value)}</span>
        {:else}
          {#if getPropertyType(value) === 'string'}
            <input
              type="text"
              class="input input-sm w-full text-left text-xs h-6 px-1"
              value={value}
              onclick={(e) => e.stopPropagation()}
              oninput={(e) => handleStringChange(key, e)}
              onblur={(e) => handleStringBlur(key, e)}
            />
          {:else if getPropertyType(value) === 'number'}
            <input
              type="number"
              class="input input-sm w-full text-left text-xs h-6 px-1"
              value={value}
              onclick={(e) => e.stopPropagation()}
              oninput={(e) => handleNumberChange(key, e)}
            />
          {:else if getPropertyType(value) === 'boolean'}
            <label class="flex items-center w-full">
              <input
                type="checkbox"
                class="h-3 w-3"
                checked={value}
                onclick={(e) => e.stopPropagation()}
                onchange={(e) => handleBooleanChange(key, e)}
              />
            </label>
          {:else if getPropertyType(value) === 'object' || getPropertyType(value) === 'array'}
            <pre class="property-value font-mono text-xs bg-surface-500/20 p-2 rounded border max-w-full overflow-auto whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
          {:else}
            <span class="property-value font-mono text-xs">{formatPropertyValue(key, value)}</span>
          {/if}
        {/if}
      </div>
      {#if key !== '_c' && key !== 'tid'}
        <button 
          class="btn-icon btn-icon-sm hover:variant-soft"
          onclick={() => deleteProperty(key)}
        >
          <TrashIcon size={14} />
        </button>
      {/if}
    </div>
  {/each}
  {#if isAddingProperty}
    <NewPropertyForm 
      onCreate={(key, value) => {
        updateProperty(key, value);
        isAddingProperty = false;
      }}
      onCancel={() => isAddingProperty = false}
    />
  {:else}
    <button 
      class="flex items-center gap-2 p-2 w-full hover:bg-surface-500/10 text-xs opacity-75"
      onclick={() => isAddingProperty = true}
    >
      <Plus size={14} />
      <span>{i18n.texts.spaceInspector.addPropertyLabel}</span>
    </button>
  {/if}
</div> 
