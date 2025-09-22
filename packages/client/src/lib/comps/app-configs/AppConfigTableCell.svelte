<script lang="ts">
  import type { AppConfig } from "@sila/core";
  import { Switch, Tooltip } from "@skeletonlabs/skeleton-svelte";
  import {
    TrashIcon,
    Pencil,
    MessageCircle,
  } from "lucide-svelte";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import { txtStore } from "@sila/client/state/txtStore";
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  let { config }: { config: AppConfig } = $props();

  let isDefault = $derived(config.id === "default");
  let deletePopoverOpen = $state(false);

  function toggleVisibility() {
    const oppositeVisible = config.visible === undefined ? true : !config.visible;
    clientState.currentSpace?.updateAppConfig(config.id, { visible: oppositeVisible });
  }

  function deleteAppConfig() {
    clientState.currentSpace?.appConfigs.delete(config);
    deletePopoverOpen = false;
  }
</script>

<div class="flex gap-4 p-2 rounded">
  <!--
  <div class="cursor-grab flex-shrink-0">
    <Tooltip contentBase="card bg-surface-200-800 p-2">
      {#snippet trigger()}
        <GripVertical class="w-4 h-4 text-surface-200-800" />
      {/snippet}
      {#snippet content()}
        Drag to reorder (not yet implemented)
      {/snippet}
    </Tooltip>
  </div>
  -->

  <!-- Start chat button + Assistant name/description -->
  <div class="flex items-start gap-2 flex-1 min-w-0 group">
    <Tooltip contentBase="card bg-surface-200-800 p-2">
      {#snippet trigger()}
        <button
          class="inline-flex items-center justify-center p-1 mt-0.5 rounded"
          title="Start Chat"
          aria-label="Start Chat"
          onclick={() => {
            clientState.layout.swins.open("new-thread", { appConfig: config }, "New conversation");
          }}
        >
          <MessageCircle class="w-4 h-4 group-hover:text-primary-600" />
        </button>
      {/snippet}
      {#snippet content()}
        Start a chat with this assistant
      {/snippet}
    </Tooltip>
    <div class="min-w-0">
      <button
        class="block text-left min-w-0"
        title={config.name}
        onclick={() => {
          clientState.layout.swins.open("new-thread", { appConfig: config }, "New conversation");
        }}
      >
        <strong class="truncate block">{config.name}</strong>
        <span class="block truncate">{config.description}</span>
      </button>
    </div>
  </div>

  <!-- Edit button -->
  <div>
    <Tooltip contentBase="card bg-surface-200-800 p-2">
      {#snippet trigger()}
        <SwinsNavButton
          component="app-config"
          title="Edit Assistant"
          props={{ configId: config.id }}
          className="inline-flex items-center justify-center p-1"
        >
          <Pencil class="w-4 h-4" />
        </SwinsNavButton>
      {/snippet}
      {#snippet content()}
        Edit Assistant
      {/snippet}
    </Tooltip>
  </div>

  <div>
    <Tooltip contentBase="card bg-surface-200-800 p-2">
      {#snippet trigger()}
        <Switch
          name={"visible-" + config.id}
          checked={config.visible !== undefined ? config.visible : false}
          controlActive="bg-secondary-500"
          onCheckedChange={(_) => toggleVisibility()}
        />
      {/snippet}
      {#snippet content()}
        {$txtStore.appConfigPage.tableCell.visibilityLabel}
      {/snippet}
    </Tooltip>
  </div>

  <div>
    {#if !isDefault}
      <ContextMenu
        open={deletePopoverOpen}
        onOpenChange={(e) => (deletePopoverOpen = e.open)}
        placement="left"
        triggerClassNames=""
        maxWidth="320px"
        arrow
        closeOnInteractOutside={true}
        closeOnEscape={true}
      >
        {#snippet trigger()}
          <Tooltip contentBase="card bg-surface-200-800 p-2">
            {#snippet trigger()}
              <TrashIcon class="w-4" />
            {/snippet}
            {#snippet content()}
              {$txtStore.appConfigPage.tableCell.deleteLabel}
            {/snippet}
          </Tooltip>
        {/snippet}

        {#snippet content()}
          <div class="btn-group-vertical preset-filled-surface-500">
            <button
              class="btn preset-filled-surface-500"
              onclick={deleteAppConfig}
              >{$txtStore.appConfigPage.tableCell.deleteButton}</button
            >
          </div>
        {/snippet}
      </ContextMenu>
    {:else}
      <Tooltip contentBase="card bg-surface-200-800 p-2">
        {#snippet trigger()}
          <div><TrashIcon class="w-4 opacity-30" /></div>
        {/snippet}
        {#snippet content()}
          {$txtStore.appConfigPage.tableCell.deleteLabel}
        {/snippet}
      </Tooltip>
    {/if}
  </div>
</div>
