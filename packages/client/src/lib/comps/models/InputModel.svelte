<script lang="ts">
  import type { ModelProvider } from "@sila/core";
  import { ProgressRing } from "@skeletonlabs/skeleton-svelte";
  import { Sparkles, CircleAlert } from "lucide-svelte/icons";
  import { providers } from "@sila/core";
  import { getActiveProviders } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  import { i18n } from "@sila/client";
  const clientState = useClientState();
  import {
    splitModelString,
    isValidModelString,
    getProviderId,
  } from "@sila/core";

  let { value = $bindable(), required }: { value: string; required?: boolean } =
    $props();

  let inputElement: HTMLInputElement;

  function onRequestChange() {
    clientState.layout.swins.open(
      swinsLayout.selectModel.key,
      {
        selectedModel: value,
        onModelSelect: (model: string) => {
          value = model;
        },
      },
      i18n.texts.models.selectModelTitle,
    );
  }

  let providerId = $state("");
  let model = $state("");
  let provider = $state<ModelProvider | null>(null);
  let error = $state("");
  let allProviders = $state<ModelProvider[]>([]);

  // Load all providers including custom ones
  $effect(() => {
    if (clientState.currentSpace) {
      const customProviders =
        clientState.currentSpace.getCustomProviders() || [];
      allProviders = getActiveProviders(customProviders);
    } else {
      allProviders = [...providers];
    }
  });

  function validate() {
    if (required && !value) {
      error = i18n.texts.models.chooseModelRequired;
      inputElement.setCustomValidity(i18n.texts.models.chooseModelRequired);
      return;
    }

    // Special case for auto
    if (value && value.startsWith("auto")) {
      error = "";
      inputElement.setCustomValidity("");
      return;
    }

    // Check if it's a valid format
    if (!isValidModelString(value)) {
      error = i18n.texts.models.invalidModelFormat(value);
      inputElement.setCustomValidity(i18n.texts.models.invalidModelFormat(value));
      return;
    }

    // Get provider ID and check if it exists
    const provId = getProviderId(value);
    if (!provId || !allProviders.some((p) => p.id === provId)) {
      const providerLabel = provId || "";
      error = i18n.texts.models.unknownProvider(providerLabel);
      inputElement.setCustomValidity(i18n.texts.models.unknownProvider(providerLabel));
      return;
    }

    error = "";
    inputElement.setCustomValidity("");
  }

  function onInputInvalid() {
    error = inputElement.validationMessage;
  }

  $effect(() => {
    update();
  });

  function update() {
    if (!value) {
      provider = null;
      providerId = "";
      model = "";
      validate();
      return;
    }

    // Parse the model string
    const modelParts = splitModelString(value);
    if (modelParts) {
      providerId = modelParts.providerId;
      model = modelParts.modelId;
    } else {
      // If invalid format, assume auto
      providerId = "auto";
      model = "";
    }

    if (providerId === "auto") {
      provider = null;
      providerId = "auto";
      model = "";
      validate();
      return;
    }

    // Find provider in all providers including custom ones
    provider = allProviders.find((p) => p.id === providerId) ?? null;
    validate();
  }
</script>

{#if !providerId || providerId === "auto"}
  <div class="input variant-form-material">
    <button
      type="button"
      class="flex p-2 gap-4 items-center cursor-pointer w-full"
      onclick={onRequestChange}
    >
      <div class="w-8 h-8 flex items-center justify-center rounded">
        <Sparkles size={18} />
      </div>
      <div class="">
        <span class="font-semibold">{i18n.texts.models.auto}</span>
      </div>
    </button>
  </div>
{:else if provider}
  <div class="input variant-form-material">
    <button
      type="button"
      class="flex p-2 gap-4 items-center cursor-pointer w-full"
      onclick={onRequestChange}
    >
      <div class="w-8 h-8 bg-white flex items-center justify-center rounded">
        <img class="w-5/6" src={provider.logoUrl} alt={provider.name} />
      </div>
      <div class="">
        <span class="font-semibold"
          >{provider.name}{model ? ` — ${model}` : ""}</span
        >
      </div>
    </button>
  </div>
{:else}
  <div class="input variant-form-material">
    <ProgressRing value={null} size="size-14" />
  </div>
{/if}
{#if error}
  <div class="flex intems-center mt-2 text-red-500 text-sm">
    <CircleAlert size={18} class="w-6 mr-2" /><span>{error}</span>
  </div>
{/if}
<input
  bind:this={inputElement}
  bind:value
  oninvalid={onInputInvalid}
  type="text"
  name="model"
  style="position: absolute; left: -9999px;"
  {required}
/>
