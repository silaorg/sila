<script lang="ts">
  import { ProviderType, type ModelProvider, type ModelProviderConfig } from "@sila/core";
  import { onMount } from "svelte";
  import { CircleAlert } from "lucide-svelte/icons";
  import ModelSelectCard from "./ModelSelectCard.svelte";
  import AutoModelSelectCard from "./AutoModelSelectCard.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { getActiveProviders, resolveMostCapableLanguageModel } from "@sila/core";
  const clientState = useClientState();
  import { splitModelString, combineModelString } from "@sila/core";
  import { formatModelLabel, getProviderDisplayName } from "@sila/client/utils/modelDisplay";
  import { i18n } from "@sila/client";

  let {
    selectedModel,
    onModelSelect,
  }: {
    selectedModel: string | null;
    onModelSelect: (model: string) => void;
  } = $props();

  let setupProviders: {
    provider: ModelProvider;
    config: ModelProviderConfig;
  }[] = $state([]);

  type SelectedPair = {
    providerId: string;
    model: string;
  };

  let selectedPair: SelectedPair | null = $state(null);
  let autoSelectionLabel = $state<string | null>(null);
  let unknownSelectedProviderId = $state<string | null>(null);

  function isLanguageProvider(provider: ModelProvider): boolean {
    return (provider.type ?? ProviderType.Language) === ProviderType.Language;
  }

  async function resolveAutoSelectionLabel(params: {
    configs: ModelProviderConfig[];
    allProviders: ModelProvider[];
  }): Promise<string | null> {
    const { configs, allProviders } = params;
    const resolved = await resolveMostCapableLanguageModel(configs);
    if (!resolved) return null;
    const providerName = getProviderDisplayName(
      resolved.provider,
      allProviders.find((p) => p.id === resolved.provider)?.name ?? null,
    );
    return `${providerName} / ${formatModelLabel(resolved.model)}`;
  }

  onMount(async () => {
    const configs = clientState.currentSpace?.getModelProviderConfigs();
    if (!configs) return;

    // Get custom providers
    const customProviders =
      clientState.currentSpace?.getCustomProviders() || [];

    // Get all active providers (built-in + custom)
    const allProviders = getActiveProviders(customProviders);

    autoSelectionLabel = await resolveAutoSelectionLabel({ configs, allProviders });

    // Process all providers
    setupProviders = allProviders
      // Only language providers can be selected as chat models.
      // This prevents non-language providers like Fal.ai (VizGen) or Exa (Search) from showing up here.
      .filter((provider) => isLanguageProvider(provider))
      .map((provider) => {
        // For custom providers, config should already exist in the configs array
        // because custom providers are saved as provider configs
        const config = configs.find((config) => config.id === provider.id);

        if (!config) {
          return null; // Skip providers without configs
        }

        return {
          provider,
          config,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (selectedModel) {
      const modelParts = splitModelString(selectedModel);
      if (modelParts) {
        selectedPair = {
          providerId: modelParts.providerId,
          model: modelParts.modelId,
        };
      }
    }

    // If the selected model references a provider we no longer know about,
    // fall back to Auto but keep a visible warning for the user.
    if (
      selectedPair &&
      selectedPair.providerId !== "auto" &&
      !setupProviders.some((p) => p.provider.id === selectedPair?.providerId)
    ) {
      unknownSelectedProviderId = selectedPair.providerId;
      onSelect("auto", "");
    }
  });

  function getPairString(pair: SelectedPair) {
    // Special case for "auto" models - they don't have a model ID
    if (pair.providerId === "auto") {
      return "auto";
    }
    return combineModelString(pair.providerId, pair.model);
  }

  function onSelect(providerId: string, model: string) {
    selectedPair = { providerId, model };

    selectedModel = getPairString(selectedPair);
    onModelSelect(selectedModel);
  }
</script>

{#if unknownSelectedProviderId}
  <div class="flex items-center gap-2 mb-2 text-error-500 text-sm">
    <CircleAlert size={18} />
    <span>{i18n.texts.models.unknownProvider(unknownSelectedProviderId)}</span>
  </div>
{/if}

<div class="grid grid-cols-1 gap-2">
  {#if setupProviders.length > 0}
    <AutoModelSelectCard
      selected={selectedPair?.providerId === "auto"}
      {autoSelectionLabel}
      {onSelect}
    />
  {/if}
  {#each setupProviders as setup (setup.provider.id)}
    <ModelSelectCard
      provider={setup.provider}
      config={setup.config}
      {onSelect}
      selected={selectedPair?.providerId === setup.provider.id}
      modelId={selectedPair?.providerId === setup.provider.id
        ? selectedPair.model
        : null}
    />
  {/each}
</div>
