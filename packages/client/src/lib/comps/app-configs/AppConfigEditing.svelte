<script lang="ts">
  import InputModel from "../models/InputModel.svelte";
  import { txtStore } from "@sila/client/state/txtStore";
  import { uuid } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";

  let {
    configId,
  }: { configId?: string } = $props();

  let isNewApp = $derived(!configId);

  let name = $state("");
  let description = $state("");
  let instructions = $state("");
  let targetLLM = $state("auto");

  let defaultConfigMessage = $derived(
    $txtStore.appConfigPage.defaultConfigMessage.replace(
      "{defaultConfigGotoNew}",
      $txtStore.appConfigPage.defaultConfigGotoNew
    )
  );

  let isDefault = $derived(configId === "default");

  $effect(() => {
    if (configId) {
      const config = clientState.currentSpace?.getAppConfig(configId);
      if (config) {
        name = config.name;
        description = config.description;
        instructions = config.instructions;
        targetLLM = config.targetLLM || "auto";
      }
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
      clientState.currentSpace?.insertIntoArray("app-configs", {
        id: newConfigId,
        name: name,
        description: description,
        instructions: instructions,
        targetLLM: targetLLM,
        visible: true,
      });

      // Dispatch custom event to notify about new assistant creation
      const event = new CustomEvent('assistant-created', {
        detail: { assistantId: newConfigId },
        bubbles: true
      });
      document.dispatchEvent(event);

      if (!clientState.layout.swins.popTo("apps")) {
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
<form class="space-y-4" bind:this={formElement}>
  {#if isDefault}
    <p>
      {@html defaultConfigMessage}
      <SwinsNavButton
        component="app-config"
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
  <button
    type="submit"
    onclick={handleSubmit}
    class="btn preset-filled-primary-500 mb-2"
  >
    {#if isNewApp}
      {$txtStore.appConfigPage.buttonCreate}
    {:else}
      {$txtStore.appConfigPage.buttonSave}
    {/if}
  </button>
</form>
