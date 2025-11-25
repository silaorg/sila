<script lang="ts">
  import InputModel from "../models/InputModel.svelte";
  import { txtStore } from "@sila/client/state/txtStore";
  import { type AppConfig, uuid } from "@sila/core";
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  const clientState = useClientState();

  let { configId }: { configId?: string } = $props();

  let isNewApp = $derived(!configId);
  let isDefault = $derived(configId === "default");

  let config: AppConfig | null = $derived.by(() => {
    if (!configId || clientState.currentSpace === null) {
      return null;
    }

    const target = clientState.currentSpace.getAppConfig(configId);
    if (!target) {
      return null;
    }

    return target;
  });

  // We define them as states because we then bind them to the form elements
  let name = $state("");
  let description = $state("");
  let instructions = $state("");
  let targetLLM = $state("auto");

  $effect(() => {
    if (config) {
      name = config.name;
      description = config.description;
      instructions = config.instructions;
      targetLLM = config.targetLLM || "auto";
    }
  });

  let formElement = $state<HTMLFormElement | undefined>(undefined);

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!formElement) {
      console.error("formElement is undefined");
      return;
    }

    if (!formElement.checkValidity()) {
      formElement.reportValidity();
      return;
    }

    if (!configId) {
      const newConfigId = uuid();
      clientState.currentSpace?.insertIntoArray("configs", {
        id: newConfigId,
        name: name,
        description: description,
        instructions: instructions,
        targetLLM: targetLLM,
        visible: true,
      });

      // Dispatch custom event to notify about new assistant creation
      const event = new CustomEvent("assistant-created", {
        detail: { assistantId: newConfigId },
        bubbles: true,
      });
      document.dispatchEvent(event);

      if (!clientState.layout.swins.popTo(swinsLayout.apps.key)) {
        clientState.layout.swins.clear();
      }
    } else {
      if (isDefault) {
        clientState.currentSpace?.updateAppConfig(configId, {
          targetLLM: targetLLM,
        });
      } else {
        clientState.currentSpace?.updateAppConfig(configId, {
          name: name,
          description: description,
          instructions: instructions,
          targetLLM: targetLLM,
        });
      }
    }
  }
</script>

<h3 class="h3 pb-6">
  {#if isNewApp}
    {$txtStore.appConfigPage.newConfigTitle}
  {:else if !isDefault}
    {$txtStore.appConfigPage.editConfigTitle}
  {:else}
    {$txtStore.appConfigPage.defaultConfigTitle}
  {/if}
</h3>
<form class="space-y-4" bind:this={formElement} onsubmit={handleSubmit}>
  {#if isDefault}
    <p>
      {$txtStore.appConfigPage.defaultConfigMessage}
        <SwinsNavButton
        component="appConfig"
        className="anchor"
        title={$txtStore.appConfigPage.defaultConfigGotoNew}
      >
        {$txtStore.appConfigPage.defaultConfigGotoNew}
      </SwinsNavButton>
    </p>
  {/if}
  <label class="label">
    <span>{$txtStore.basics.name}</span>
    <input
      name="name"
      class="input"
      type="text"
      placeholder={$txtStore.appConfigPage.namePlaceholder}
      required
      bind:value={name}
      disabled={isDefault}
    />
  </label>
  <label class="label">
    <span>{$txtStore.basics.description}</span>
    <input
      name="description"
      class="input"
      type="text"
      placeholder={$txtStore.appConfigPage.descriptionPlaceholder}
      required
      bind:value={description}
      disabled={isDefault}
    />
  </label>
  <label class="label">
    <span>{$txtStore.basics.instructions}</span>
    <textarea
      name="instructions"
      class="textarea"
      rows="7"
      placeholder={$txtStore.appConfigPage.instructionsPlaceholder}
      required
      bind:value={instructions}
      disabled={isDefault}
    ></textarea>
  </label>
  <div class="label">
    <span>{$txtStore.basics.model}</span>
    <InputModel bind:value={targetLLM} required />
  </div>
  <div class="flex justify-end">
    <button
      type="submit"
      class="btn preset-filled-primary-500 mb-2"
    >
      {#if isNewApp}
        {$txtStore.appConfigPage.buttonCreate}
      {:else}
        {$txtStore.appConfigPage.buttonSave}
      {/if}
    </button>
  </div>
</form>
