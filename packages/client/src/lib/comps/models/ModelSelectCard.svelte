<script lang="ts">
  import { onMount } from "svelte";
  import type { ModelProvider, ModelProviderConfig } from "@sila/core";
  import { getProviderModels } from "@sila/core";
  import { ProviderType } from "@sila/core";
  import { i18n } from "@sila/client";

  let {
    provider,
    config,
    selected,
    onSelect,
    modelId = $bindable(),
  }: {
    provider: ModelProvider;
    config: ModelProviderConfig;
    selected: boolean;
    onSelect: (providerId: string, model: string) => void;
    modelId: string | null;
  } = $props();

  let prevSelectedModelId: string | null = null;
  let models = $state<string[]>([]);
  let showModels = $state(false);
  let customModelInput = $state("");
  
  // Check if this is a custom provider
  const isCustomProvider = $derived(provider.isCustom === true);
  // Check if this is OpenRouter provider
  const isOpenRouterProvider = $derived(provider.id === "openrouter");
  // This card is for selecting chat language models; non-language providers are not selectable here.
  const isLanguageProvider = $derived(
    (provider.type ?? ProviderType.Language) === ProviderType.Language,
  );
  // For custom providers, get the model ID from the config
  const customModelId = $derived(isCustomProvider && 'modelId' in config ? config.modelId as string : null);

  onMount(async () => {
    // Only fetch models for non-custom providers and non-OpenRouter providers
    if (!isCustomProvider && !isOpenRouterProvider) {
      models = await getProviderModels(
        provider.id,
        config.type !== "cloud" ? "" : config.apiKey,
      );
    }
    
    // Initialize custom model input for OpenRouter
    if (isOpenRouterProvider && modelId) {
      customModelInput = modelId;
    }
  });

  function onProviderClick() {
    if (!isLanguageProvider) {
      return;
    }
    if (selected) {
      return;
    }

    if (isCustomProvider && customModelId) {
      // For custom providers, use the model ID from the config
      modelId = customModelId;
      onSelect(provider.id, modelId);
      return;
    }

    if (isOpenRouterProvider) {
      // For OpenRouter, use the custom input or default model
      modelId = customModelInput || provider.defaultModel || "";
      onSelect(provider.id, modelId);
      return;
    }

    if (modelId === null) {
      if (prevSelectedModelId && models.includes(prevSelectedModelId)) {
        modelId = prevSelectedModelId;
      } else if (
        provider.defaultModel &&
        models.includes(provider.defaultModel)
      ) {
        modelId = provider.defaultModel;
      } else if (models.length > 0) {
        modelId = models[0];
      } else {
        modelId = provider.defaultModel || "";
      }
    }

    onSelect(provider.id, modelId || "");
  }

  function onChangeModel(model: string) {
    const finalModel = model === "auto" && provider.defaultModel ? provider.defaultModel : model;
    onSelect(provider.id, finalModel);
    modelId = finalModel;
    prevSelectedModelId = finalModel;
    showModels = false;
  }

  function onCustomModelInputChange() {
    modelId = customModelInput;
    onSelect(provider.id, customModelInput);
  }

  function onCustomModelKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      onCustomModelInputChange();
    }
  }
</script>

<div
  class="rounded {selected
    ? 'border border-primary-500'
    : 'border border-surface-500'}"
>
  <div
    role="button"
    tabindex="0"
    aria-disabled={!isLanguageProvider}
    class="flex p-2 gap-4 items-center w-full {isLanguageProvider ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}"
    onclick={onProviderClick}
    onkeydown={(e) => {
      if (!isLanguageProvider) return;
      if (e.key === "Enter") onProviderClick();
    }}
  >
    <div class="w-8 h-8 bg-white flex items-center justify-center rounded">
      <img class="w-5/6" src={provider.logoUrl} alt={provider.name} />
    </div>
    <div class="flex-1">
      <span class="font-semibold">
        {provider.name}
      </span>
      {#if isCustomProvider && customModelId}
        <span class="font-semibold">
          — {customModelId}&nbsp;
        </span>
      {:else if selected && !showModels && modelId && modelId !== provider.defaultModel}
        <span class="font-semibold">
          — {modelId}&nbsp;
        </span>
      {/if}
    </div>
    {#if selected && !isCustomProvider}
      {#if isOpenRouterProvider}
        <button
          class="btn btn-sm preset-filled-primary-500"
          onclick={() => (showModels = true)}
          >{i18n.texts.models.enterModel}</button
        >
      {:else}
        {#if !showModels}
          <button
            class="btn btn-sm preset-filled-primary-500"
            onclick={() => (showModels = true)}
            >{!modelId || modelId === provider.defaultModel
              ? i18n.texts.models.chooseModel
              : i18n.texts.actions.change}</button
          >
        {:else}
          <button
            class="btn btn-sm preset-filled-primary-500"
            onclick={() => (showModels = false)}>{i18n.texts.actions.done}</button
          >
        {/if}
      {/if}
    {/if}
  </div>
  <div>
    {#if selected && !isCustomProvider}
      {#if showModels}
        <div class="p-2 space-y-4">
          {#if isOpenRouterProvider}
            <div class="space-y-2">
              <label class="label">
                <span class="text-sm font-medium">
                  {i18n.texts.models.modelNameLabel}
                </span>
                <input
                  class="input rounded-container"
                  type="text"
                  placeholder={i18n.texts.models.openRouterPlaceholder}
                  bind:value={customModelInput}
                  oninput={onCustomModelInputChange}
                  onkeydown={onCustomModelKeydown}
                />
              </label>
              <p class="text-xs text-surface-500">
                {i18n.texts.models.openRouterHelp}
              </p>
              <button
                class="btn btn-sm preset-filled-primary-500"
                onclick={() => (showModels = false)}>{i18n.texts.actions.done}</button
              >
            </div>
          {:else}
            <select
              class="select rounded-container"
              size={provider.defaultModel ? models.length : models.length + 1}
              value={!modelId || modelId === provider.defaultModel
                ? "auto"
                : modelId}
              onchange={(e) => onChangeModel(e.currentTarget.value)}
            >
              <option value="auto"
                >{i18n.texts.models.defaultOption(
                  provider.defaultModel || i18n.texts.models.auto
                )}</option
              >
              {#each models.filter((model) => model !== provider.defaultModel && model) as model}
                <option value={model}>{model}</option>
              {/each}
            </select>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
