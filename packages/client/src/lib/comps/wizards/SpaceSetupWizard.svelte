<script lang="ts">
  import Wizard from "@sila/client/comps/wizards/Wizard.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
  import Lightswitch from "@sila/client/comps/basic/Lightswitch.svelte";
  import { onMount } from "svelte";
  import ThemeSwitcher from "../themes/ThemeSwitcher.svelte";
  import type { ModelProvider } from "@sila/core";
  import { i18n } from "@sila/client";
  import { ProviderType, providers as builtInProviders } from "@sila/core";

  let spaceName = $state("");
  let spaceNameError = $state(""); // Kept for potential future use, though Wizard handles its own validation display
  let hasSetupProvider = $state(false);
  let hasSetupSearchProvider = $state(false);

  const spaceState = $derived(clientState.currentSpaceState);
  const space = $derived(clientState.currentSpace);

  let presetNames = $derived(i18n.texts.workspaceCreate.presetNames);

  //const wizardSteps = ["name", "provider", "theme"];
  const wizardSteps = ["provider", "search", "theme"];

  //const wizardTitles = ["Name", "Brains", "Theme"];
  let wizardTitles = $derived([
    i18n.texts.wizards.spaceSetupBrainsStepTitle,
    i18n.texts.wizards.spaceSetupSearchStepTitle,
    i18n.texts.wizards.spaceSetupThemeStepTitle
  ]);

  let currentWizardStep = $state(0);

  function getEffectiveProviderType(providerId: string): ProviderType {
    const provider = builtInProviders.find((p) => p.id === providerId);
    // Anything unknown (e.g. custom providers) defaults to AI
    return provider?.type ?? ProviderType.AI;
  }

  $effect(() => {
    if (space) {
      const providerVertex = space.tree.getVertexByPath("providers");
      if (providerVertex) {
        const configuredProviderIds = providerVertex.children
          .map((c) => c.getProperty("id"))
          .filter((id): id is string => typeof id === "string");

        hasSetupProvider = configuredProviderIds.some(
          (id) => getEffectiveProviderType(id) === ProviderType.AI,
        );
        hasSetupSearchProvider = configuredProviderIds.some(
          (id) => getEffectiveProviderType(id) === ProviderType.Search,
        );
      }
    }
  });

  function handleCancel() {
    if (!space) {
      return;
    }

    clientState.removeSpace(spaceState?.pointer.uri ?? space.getId());
  }

  onMount(() => {
    if (space) {
      spaceState?.spaceTelemetry.onboardingOpened();
      let name = space.name;
      // If the space has no name, use the last part of the URI as the name
      if (!name && spaceState?.pointer.uri) {
        const uri = spaceState.pointer.uri;
        const parts = uri.split("/");
        if (parts.length > 0) {
          name = parts[parts.length - 1];
        }
      }

      spaceName = name || presetNames[0];
    }
  });

  function handleProviderConnect(provider: ModelProvider) {
    hasSetupProvider = true;
    spaceState?.spaceTelemetry.onboardingProviderConnected({
      provider_id: provider.id
    });
  }

  function handleSearchProviderConnect(provider: ModelProvider) {
    hasSetupSearchProvider = true;
    spaceState?.spaceTelemetry.onboardingProviderConnected({
      provider_id: provider.id
    });
  }

  function handleStepChange(newStep: number) {
    currentWizardStep = newStep;

    // @NOTE: we're probably going to remove this as we changed how the space is named now
    /*
    if (newStep === 1) {
      // Moving from step 0 (Name) to step 1 (Provider)
      // Allow empty space name (skip naming)
      if (!spaceName.trim()) {
        spaceName = "My Workspace"; // Default name if skipped
      }

      // Save space name using the new method
      if (clientState.currentSpaceState && clientState.currentSpaceId) {
        clientState.updateSpaceName(clientState.currentSpaceId, spaceName);
      }
      spaceNameError = ""; // Clear any previous error
    }
    */
  }

  function completeSetup() {
    if (space) {
      const rootVertex = space.tree.root!;
      space.tree.setVertexProperty(rootVertex.id, "onboarding", false);
      spaceState?.spaceTelemetry.onboardingCompleted({
        provider_connected: hasSetupProvider
      });
      // Potentially navigate away or show a success message
    }
  }

  let canAdvance = $derived(currentWizardStep === 0 ? hasSetupProvider : true);
</script>

<Wizard
  steps={wizardSteps}
  titles={wizardTitles}
  onComplete={completeSetup}
  onStepChange={handleStepChange}
  onCancel={handleCancel}
  {canAdvance}
  bind:step={currentWizardStep}
>
  {#snippet children({ currentStep }: { currentStep: number })}
    <!-- Note: we disabled the name step for now that is why it's -1 -->
    {#if currentStep === -1}
      <!-- Step 1: Space Name -->
      <h2 class="h3 mb-4">{i18n.texts.wizards.spaceSetupNameTitle}</h2>
      <p class="mb-4">
        {i18n.texts.wizards.spaceSetupNameDescription}
      </p>

      <div class="form-control w-full mb-4">
        <label class="label" for="spaceName">
          <span class="label-text">{i18n.texts.wizards.spaceSetupNameLabel}</span>
        </label>
        <input
          id="spaceName"
          type="text"
          placeholder={i18n.texts.wizards.spaceSetupNamePlaceholder}
          class="input {spaceNameError ? 'input-error' : ''}"
          bind:value={spaceName}
        />
        {#if spaceNameError}
          <p class="text-error-500 text-sm mt-1">{spaceNameError}</p>
        {/if}
      </div>

      <div class="mb-6">
        <p class="text-sm mb-2">
          {i18n.texts.wizards.spaceSetupNameHint}
        </p>
        <div class="flex flex-wrap gap-2">
          {#each presetNames as name}
            <button
              class="btn btn-sm preset-outlined"
              class:preset-filled={name.toLocaleLowerCase() ===
                spaceName.toLocaleLowerCase()}
              onclick={() => (spaceName = name)}
            >
              {name}
            </button>
          {/each}
        </div>
      </div>
    {:else if currentStep === 0}
      <!-- Step 2: Model Provider -->
      <h2 class="h3 mb-4">{i18n.texts.wizards.spaceSetupBrainsTitle}</h2>
      <p class="mb-4">
        {i18n.texts.wizards.spaceSetupBrainsDescription}
      </p>

      <div class="overflow-y-auto pr-2">
        <ModelProviders onConnect={handleProviderConnect} providerType={ProviderType.AI} />
      </div>
    {:else if currentStep === 1}
      <!-- Step 3: Search Provider (optional) -->
      <h2 class="h3 mb-4">{i18n.texts.wizards.spaceSetupSearchTitle}</h2>
      <p class="mb-4">
        {i18n.texts.wizards.spaceSetupSearchDescription}
      </p>

      <div class="overflow-y-auto pr-2">
        <ModelProviders
          onConnect={handleSearchProviderConnect}
          providerType={ProviderType.Search}
        />
      </div>
    {:else if currentStep === 2}
      <!-- Step 3: Theme -->
      <h2 class="h3 mb-4">{i18n.texts.wizards.spaceSetupLookTitle}</h2>
      <div class="mb-4 space-y-4">
        <label class="label">
          <span>{i18n.texts.wizards.colorSchemeLabel}</span>
          <Lightswitch />
        </label>

        <label class="label">
          <span>{i18n.texts.wizards.themeLabel}</span>
          <ThemeSwitcher />
        </label>
      </div>
    {/if}
  {/snippet}
</Wizard>
