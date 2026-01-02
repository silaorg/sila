<script lang="ts">
  import type { AppConfig } from "@sila/core";
  import { Switch, Tooltip } from "@skeletonlabs/skeleton-svelte";
  import {
    TrashIcon,
    Pencil,
    MessageCircle,
  } from "lucide-svelte";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import { i18n } from "@sila/client";
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  const clientState = useClientState();

  let { config, inSettings = false }: { config: AppConfig; inSettings?: boolean } = $props();

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

  function openEdit() {
    clientState.layout.swins.open(swinsLayout.appConfig.key, { configId: config.id }, "Edit Assistant");
  }
</script>

{#if inSettings}
  <!-- Settings mode: clickable card with model provider styling -->
  <div class="rounded border border-surface-100-900 p-2 flex items-center gap-3 h-full">
    <div
      role="button"
      tabindex="0"
      class="flex items-center justify-between flex-grow min-w-0 cursor-pointer"
      onclick={openEdit}
      onkeydown={(e) => e.key === "Enter" && openEdit()}
    >
      <div class="min-w-0">
        <strong class="truncate block font-semibold">{config.name}</strong>
        <span class="block truncate text-sm text-surface-500">{config.description}</span>
      </div>
    </div>

    <div class="flex items-center gap-2 flex-shrink-0">
      <div onclick={(e) => e.stopPropagation()}>
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
            {i18n.texts.appConfigPage.tableCell.visibilityLabel}
          {/snippet}
        </Tooltip>
      </div>

      <div onclick={(e) => e.stopPropagation()}>
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
                  {i18n.texts.appConfigPage.tableCell.deleteLabel}
                {/snippet}
              </Tooltip>
            {/snippet}

            {#snippet content()}
              <div class="btn-group-vertical preset-filled-surface-500">
                <button
                  class="btn preset-filled-surface-500"
                  onclick={deleteAppConfig}
                  >{i18n.texts.appConfigPage.tableCell.deleteButton}</button
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
              {i18n.texts.appConfigPage.tableCell.deleteLabel}
            {/snippet}
          </Tooltip>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <!-- Default mode: original layout with icons -->
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
            data-role="start-chat-assistant"
            onclick={() => {
              clientState.layout.swins.open(swinsLayout.newThread.key, { appConfig: config }, "New conversation");
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
          class="block text-left min-w-0 ph-no-capture"
          title={config.name}
          data-role="open-assistant"
          onclick={() => {
            clientState.layout.swins.open(swinsLayout.newThread.key, { appConfig: config }, "New conversation");
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
            component="appConfig"
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
          {i18n.texts.appConfigPage.tableCell.visibilityLabel}
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
                {i18n.texts.appConfigPage.tableCell.deleteLabel}
              {/snippet}
            </Tooltip>
          {/snippet}

          {#snippet content()}
            <div class="btn-group-vertical preset-filled-surface-500">
              <button
                class="btn preset-filled-surface-500"
                onclick={deleteAppConfig}
                >{i18n.texts.appConfigPage.tableCell.deleteButton}</button
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
            {i18n.texts.appConfigPage.tableCell.deleteLabel}
          {/snippet}
        </Tooltip>
      {/if}
    </div>
  </div>
{/if}
