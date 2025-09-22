<script lang="ts">
  import { onMount } from "svelte";
  import type { AppConfig } from "@sila/core";
  import { txtStore } from "@sila/client/state/txtStore.ts";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import { ChevronUp, Pencil, Plus } from "lucide-svelte";
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  let {
    configId = "",
    onChange,
    highlighted = false,
  }: { configId: string; onChange?: (id: string) => void; highlighted?: boolean } = $props();

  let visibleAppConfigs = $state<AppConfig[]>([]);
  let appConfigs = $state<AppConfig[]>([]);

  let currentConfig = $derived.by(() => {
    return visibleAppConfigs.find((config) => config.id === configId);
  });

  let openState = $state(false);

  onMount(() => {
    const unobserve = clientState.currentSpace?.appConfigs.observe((configs) => {
      appConfigs = configs;
      visibleAppConfigs = configs.filter((config) => config.visible);
    });

    // Listen for assistant-created events
    const handleAssistantCreated = (event: CustomEvent) => {
      const { assistantId } = event.detail;
      if (assistantId && onChange) {
        onChange(assistantId);
      }
    };

    document.addEventListener('assistant-created', handleAssistantCreated as EventListener);

    return () => {
      unobserve?.();
      document.removeEventListener('assistant-created', handleAssistantCreated as EventListener);
    };
  });

  function selectConfig(id: string) {
    if (onChange) onChange(id);
    openState = false;
  }
</script>

<ContextMenu
  open={openState}
  onOpenChange={(e) => (openState = e.open)}
  placement="bottom"
>
  {#snippet trigger()}
    <button
      class="flex items-center gap-2 px-2 py-1 rounded-container transition-colors"
      class:preset-outlined-primary-500={highlighted}
      class:preset-outlined-surface-200-800={!highlighted}
    >
      <span class="text-left truncate min-w-0">
        {#if visibleAppConfigs.length > 0 && currentConfig}
          {#if configId}
            {#each visibleAppConfigs as config}
              {#if config.id === configId}
                {config.name}
              {/if}
            {/each}
          {:else}
            {visibleAppConfigs[0].name}
          {/if}
        {:else}
          {$txtStore.appConfigDropdown.placeholder}
        {/if}
      </span>
      <ChevronUp size={18} class={highlighted ? 'text-primary-500' : 'text-surface-200-800'} />
    </button>
  {/snippet}
  {#snippet content()}
    {#if appConfigs.length > 1 || (configId && !currentConfig)}
      <div class="flex flex-col gap-1 mb-4">
        {#each visibleAppConfigs as config (config.id)}
          <button
            class="btn btn-sm w-full text-left justify-start"
            class:preset-filled-secondary-500={config.id === configId}
            onclick={() => selectConfig(config.id)}
          >
            <span
              ><strong>{config.name}</strong><br />
              {config.description}</span
            >
          </button>
        {/each}
      </div>
    {/if}
    <div class="flex flex-col gap-1">
      {#if currentConfig}
        <SwinsNavButton
          className="btn btn-sm w-full text-left justify-start"
          component="app-config"
          title="Edit Config"
          props={{ configId }}
          onclick={() => {
            openState = false;
          }}><Pencil size={16} />Edit "{currentConfig?.name}" assistant</SwinsNavButton
        >
      {/if}
      <SwinsNavButton
        className="btn btn-sm w-full text-left justify-start"
        component="app-config"
        title="New Assistant"
        onclick={() => {
          openState = false;
        }}><Plus size={16} />New Assistant</SwinsNavButton
      >
    </div>
  {/snippet}
</ContextMenu>
