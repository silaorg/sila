<script lang="ts">
  import Wizard from "@sila/client/comps/wizards/Wizard.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
  import Lightswitch from "@sila/client/comps/basic/Lightswitch.svelte";
  import { onMount } from "svelte";
  import ThemeSwitcher from "../themes/ThemeSwitcher.svelte";

  let spaceName = $state("");
  let spaceNameError = $state(""); // Kept for potential future use, though Wizard handles its own validation display
  let hasSetupProvider = $state(false);

  const presetNames = ["Personal", "Work", "Studies", "School"];

  //const wizardSteps = ["name", "provider", "theme"];
  const wizardSteps = ["provider", "theme"];

  //const wizardTitles = ["Name", "Brains", "Theme"];
  const wizardTitles = ["Brains", "Theme"];

  let currentWizardStep = $state(0);

  $effect(() => {
    const space = clientState.currentSpace;
    if (space) {
      const providerVertex = space.tree.getVertexByPath("providers");
      if (providerVertex) {
        hasSetupProvider = providerVertex.children.length > 0;
      }
    }
  });

  function handleCancel() {
    const space = clientState.currentSpace;

    if (!space) {
      return;
    }

    // Use legacy system for removal operations to maintain compatibility
    clientState.removeSpace(space.getId());
  }

  onMount(() => {
    const space = clientState.currentSpace;
    if (space) {
      let name = space.name;
      // If the space has no name, use the last part of the URI as the name
      if (!name && clientState.currentSpaceState?.pointer.uri) {
        const uri = clientState.currentSpaceState.pointer.uri;
        const parts = uri.split("/");
        if (parts.length > 0) {
          name = parts[parts.length - 1];
        }
      }

      spaceName = name || presetNames[0];
    }
  });

  function handleProviderConnect() {
    hasSetupProvider = true;
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
    const space = clientState.currentSpace;
    if (space) {
      const rootVertex = space.tree.root!;
      space.tree.setVertexProperty(rootVertex.id, "onboarding", false);
      // Potentially navigate away or show a success message
    }
  }

  let canAdvance = $derived.by(() => {
    if (currentWizardStep === 0 && !hasSetupProvider) {
      return false;
    }
    return true;
  });
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
      <h2 class="h3 mb-4">Name your workspace</h2>
      <p class="mb-4">
        Give your workspace a name to help you identify it, or skip to continue
        with a default name. You can always change it later.
      </p>

      <div class="form-control w-full mb-4">
        <label class="label" for="spaceName">
          <span class="label-text">Workspace name</span>
        </label>
        <input
          id="spaceName"
          type="text"
          placeholder="My Workspace"
          class="input {spaceNameError ? 'input-error' : ''}"
          bind:value={spaceName}
        />
        {#if spaceNameError}
          <p class="text-error-500 text-sm mt-1">{spaceNameError}</p>
        {/if}
      </div>

      <div class="mb-6">
        <p class="text-sm mb-2">
          You can give a simple name that describes the purpose of the
          workspace:
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
      <h2 class="h3 mb-4">Setup brains for your workspace</h2>
      <p class="mb-4">
        Connect at least one AI model provider to start using Sila. We recommend
        setting up OpenAI, Anthropic or DeepSeek first.
      </p>

      <div class="overflow-y-auto pr-2">
        <ModelProviders onConnect={handleProviderConnect} />
      </div>
    {:else if currentStep === 1}
      <!-- Step 3: Theme -->
      <h2 class="h3 mb-4">Choose the look of your workspace</h2>
      <div class="mb-4 space-y-4">
        <label class="label">
          <span>Color scheme</span>
          <Lightswitch />
        </label>

        <label class="label">
          <span>Theme</span>
          <ThemeSwitcher />
        </label>
      </div>
    {/if}
  {/snippet}
</Wizard>
