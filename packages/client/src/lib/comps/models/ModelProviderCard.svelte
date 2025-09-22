<script lang="ts">
  import type { ModelProvider, ModelProviderLocalConfig } from "@sila/core";
  import ModelProviderApiKeyForm from "./ModelProviderApiKeyForm.svelte";
  import ModelProviderOllamaAddressForm from "./ModelProviderOllamaAddressForm.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { onMount } from "svelte";
  const clientState = useClientState();
  import { checkOllamaStatus } from "./ollama";
  import { Tooltip } from "@skeletonlabs/skeleton-svelte";
  import { CircleAlert } from "lucide-svelte/icons";
  import { interval } from "@sila/core";
  import { ExternalLink } from "lucide-svelte";

  type ProviderStatus = "disconnected" | "invalid-key" | "connected";

  let status: ProviderStatus = $state("disconnected");
  let isEditing = $state(false);
  let isConfigured = $state(false);
  let isChecking = $state(false);
  let validationError = $state<string | null>(null);
  let showValidationWarning = $derived(
    status === ("invalid-key" as ProviderStatus),
  );

  let {
    provider,
    onConnect = () => {},
    onDisconnect = () => {},
    onHow = () => {},
  }: {
    provider: ModelProvider;
    onConnect?: (provider: ModelProvider) => void;
    onDisconnect?: (provider: ModelProvider) => void;
    onHow?: (provider: ModelProvider) => void;
  } = $props();

  let cancelInterval: () => void;

  onMount(() => {
    checkConfigurationAndStatus();
    cancelInterval = interval(checkConfigurationAndStatus, 30000);
    return cancelInterval;
  });

  // Observe provider configuration changes
  $effect(() => {
    if (!clientState.currentSpace) return;

    const providersVertex =
      clientState.currentSpace.tree.getVertexByPath("providers");
    if (!providersVertex) return;

    const unobserve = providersVertex.observe((events) => {
      // Check if this event affects our provider
      if (events.some((e) => e.type === "property" || e.type === "children")) {
        checkConfigurationAndStatus();
      }
    });

    return () => unobserve();
  });

  async function checkConfigurationAndStatus() {
    // First check if the provider is configured
    const config = clientState.currentSpace?.getModelProviderConfig(
      provider.id,
    ) as ModelProviderLocalConfig | undefined;
    isConfigured = !!config;

    // For Ollama, check if it's running
    if (provider.name === "Ollama") {
      isChecking = true;
      try {
        const isRunning = await checkOllamaStatus(config);
        if (isRunning) {
          status = "connected";
          onConnect(provider);
        } else {
          status = "disconnected";
          onDisconnect(provider);
        }
      } catch (e) {
        status = "disconnected";
        onDisconnect(provider);
      } finally {
        isChecking = false;
      }
      return;
    }

    // For other providers
    if (!isConfigured) {
      status = "disconnected";
      return;
    }

    // For cloud providers, check their status
    isChecking = true;
    try {
      const providerStatus =
        await clientState.currentSpace?.getModelProviderStatus(
          provider.id,
        );

      if (providerStatus === "valid") {
        status = "connected";
        onConnect(provider);
      } else if (providerStatus === "invalid") {
        status = "invalid-key";
        validationError =
          "API key validation failed. The key might be invalid or expired.";
        onDisconnect(provider);
      } else {
        status = "disconnected";
        validationError = "Connection failed. Please check your network.";
        onDisconnect(provider);
      }
    } catch (error) {
      status = "disconnected";
      onDisconnect(provider);
    } finally {
      isChecking = false;
    }
  }

  function disconnect() {
    status = "disconnected";
    isConfigured = false;
    validationError = null;
    onDisconnect(provider);
    clientState.currentSpace?.deleteModelProviderConfig(provider.id);
  }
</script>

<div
  class="rounded border border-surface-100-900 p-2 flex items-center gap-3 h-full"
  class:border-token={isConfigured && !showValidationWarning}
  class:border-warning-500={showValidationWarning}
>
  <div
    class="w-12 h-12 bg-white flex flex-shrink-0 items-center justify-center rounded"
  >
    <img class="p-2" src={provider.logoUrl} alt={provider.name} />
  </div>
  <div class="flex items-center justify-between flex-grow">
    <div class="flex items-center gap-2">
      <span class="font-semibold">{provider.name}</span>
      <a
        href={provider.url}
        target="_blank"
        class="text-surface-500 hover:text-surface-700 transition-colors"
        title="Visit provider website"
      >
        <ExternalLink size={14} />
      </a>
      {#if isConfigured}
        <div class="flex items-center gap-1">
          <span
            class="badge badge-sm {showValidationWarning
              ? 'preset-filled-warning-500'
              : 'preset-filled-success-500'} {isChecking
              ? 'animate-pulse'
              : ''}">Connected</span
          >
          {#if showValidationWarning}
            <Tooltip
              positioning={{ placement: "top" }}
              triggerBase="underline"
              contentBase="card preset-filled p-4"
              openDelay={200}
            >
              {#snippet trigger()}
                <CircleAlert size={14} class="text-warning-500" />
              {/snippet}
              {#snippet content()}
                <div class="text-sm max-w-[200px]">
                  {validationError ||
                    "Validation failed. Check your API key or connection."}
                </div>
              {/snippet}
            </Tooltip>
          {/if}
        </div>
      {/if}
    </div>

    {#if !isEditing}
      <div class="flex gap-2">
        {#if isConfigured}
          {#if provider.access !== "local"}
            <button
              class="btn btn-sm preset-outlined-surface-500"
              onclick={disconnect}
            >
              Disconnect
            </button>
          {/if}
        {:else if provider.access === "local"}
          <button
            class="btn btn-sm preset-outlined-surface-500"
            onclick={() => (isEditing = true)}
          >
            Configure
          </button>
          <button
            class="btn btn-sm preset-outlined-surface-500"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHow(provider);
            }}
          >
            How?
          </button>
        {:else}
          <button
            class="btn btn-sm preset-filled-primary-500"
            onclick={() => (isEditing = true)}
          >
            Connect
          </button>
          <button
            class="btn btn-sm preset-outlined-surface-500"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHow(provider);
            }}
          >
            How?
          </button>
        {/if}
      </div>
    {:else if provider.access === "cloud"}
      <ModelProviderApiKeyForm
        id={provider.id}
        onValidKey={(key) => {
          isEditing = false;
          isConfigured = true;
          status = "connected";
          onConnect(provider);
        }}
        onBlur={(key) => {
          if (!key) {
            isEditing = false;
          }
        }}
        onClose={() => {
          isEditing = false;
        }}
      />
    {:else if provider.name === "Ollama"}
      <ModelProviderOllamaAddressForm
        id={provider.id}
        onValidAddress={(address) => {
          isEditing = false;
          checkConfigurationAndStatus();
        }}
        onBlur={(address) => {
          if (!address) {
            isEditing = false;
          }
        }}
        onClose={() => {
          isEditing = false;
        }}
      />
    {/if}
  </div>
</div>
