<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
  import CenteredPage from "@sila/client/comps/basic/CenteredPage.svelte";
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  let showProviderSetupPage = $state(false);
  let allowToStartNewConversationFromProviderSetup = $state(false);
  let setupProviderFromScratch = $state(false);

  $effect(() => {
    if (!clientState.currentSpace) {
      return;
    }

    showProviderSetupPage =
      clientState.currentSpace.getModelProviderConfigs().length === 0;

    const providerVertex =
      clientState.currentSpace.tree.getVertexByPath("providers");
    console.log(providerVertex);
    if (!providerVertex) {
      return;
    }

    const unobserve = providerVertex.observeChildren(() => {
      const hasProviders = providerVertex.children.length > 0;

      allowToStartNewConversationFromProviderSetup = hasProviders;
    });

    return () => {
      unobserve();
    };
  });
</script>

<CenteredPage>
  {#if showProviderSetupPage}
    <!-- Show model providers setup if no provider is configured -->
    <div class="w-full max-w-3xl">
      <h2 class="h3 mb-4 mt-4">{i18n.texts.noTabs.setupBrainsTitle}</h2>
      <p class="mb-4">
        {i18n.texts.noTabs.setupBrainsDescription}
      </p>
      {#if allowToStartNewConversationFromProviderSetup}
        <div class="card preset-tonal p-4 space-y-4 mb-4">
          <p>{i18n.texts.noTabs.readyToStartMessage}</p>
          <SwinsNavButton
            component="newThread"
            title={i18n.texts.noTabs.newConversationTitle}
            className="btn preset-filled"
          >
            {i18n.texts.noTabs.startConversationButton}
          </SwinsNavButton>
        </div>
      {/if}
      <ModelProviders />
    </div>
  {:else}
    <!-- Show new thread UI when at least one provider is configured -->
    <div class="w-full max-w-3xl">
      <h2 class="h3 mb-4">{i18n.texts.noTabs.chatTitle}</h2>
      <p class="mb-6">{i18n.texts.noTabs.todoNewThread}</p>
    </div>
  {/if}
</CenteredPage>
