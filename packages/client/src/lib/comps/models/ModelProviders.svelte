<script lang="ts">
  import type { ModelProvider } from "@sila/core";
  import ModelProviderCard from "./ModelProviderCard.svelte";
  import CustomProviderCard from "./CustomProviderCard.svelte";
  import AddCustomProviderCard from "./AddCustomProviderCard.svelte";
  import { ProviderType, providers } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { getActiveProviders } from "@sila/core";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  const clientState = useClientState();

  let customProviders = $state<ModelProvider[]>([]);

  let {
    onConnect,
    onDisconnect,
    providerType,
  }: {
    onConnect?: (provider: ModelProvider) => void;
    onDisconnect?: (provider: ModelProvider) => void;
    providerType?: ProviderType;
  } = $props();

  function getEffectiveProviderType(provider: ModelProvider): ProviderType {
    return provider.type ?? ProviderType.Language;
  }

  function filterByType(list: ModelProvider[]): ModelProvider[] {
    if (providerType === undefined) return list;
    return list.filter((p) => getEffectiveProviderType(p) === providerType);
  }

  function onHow(provider: ModelProvider) {
    clientState.layout.swins.open(
      swinsLayout.howToSetupModelProvider.key,
      { provider },
      provider.name,
    );
  }

  function refreshCustomProviders() {
    if (!clientState.currentSpace) return;

    const customConfigs = clientState.currentSpace.getCustomProviders();
    // Get all active providers (built-in + custom)
    const allProviders = getActiveProviders(customConfigs);
    // Filter to just the custom ones
    customProviders = allProviders.filter((p) => p.isCustom);
  }

  // Load custom providers on mount and when space changes
  $effect(() => {
    if (clientState.currentSpace) {
      refreshCustomProviders();
    }
  });

  function handleCustomProviderAdded() {
    refreshCustomProviders();
  }

  function handleCustomProviderDeleted() {
    refreshCustomProviders();
  }
</script>

<div class="relative">
  <div class="grid grid-cols-1 gap-2">
    {#each filterByType(providers) as provider (provider.id)}
      <ModelProviderCard {provider} {onConnect} {onDisconnect} {onHow} />
    {/each}

    {#each filterByType(customProviders) as provider (provider.id)}
      <CustomProviderCard
        {provider}
        {onConnect}
        {onDisconnect}
        onDeleted={handleCustomProviderDeleted}
      />
    {/each}

    {#if providerType === undefined || providerType === ProviderType.Language}
      <AddCustomProviderCard onProviderAdded={handleCustomProviderAdded} />
    {/if}
  </div>
</div>
