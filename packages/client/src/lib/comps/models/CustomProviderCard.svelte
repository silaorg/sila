<script lang="ts">
  import type { ModelProvider } from "@sila/core";
  import { Pencil, Trash2, CircleAlert } from "lucide-svelte";
  import { Tooltip } from "@skeletonlabs/skeleton-svelte";
  import CustomProviderForm from "./CustomProviderForm.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { getActiveProviders } from "@sila/core";
  const clientState = useClientState();

  let {
    provider,
    onConnect,
    onDisconnect,
    onDeleted,
  }: {
    provider: ModelProvider;
    onConnect?: (provider: ModelProvider) => void;
    onDisconnect?: (provider: ModelProvider) => void;
    onDeleted?: () => void;
  } = $props();

  let isEditing = $state(false);
  let isConfigured = $state(false);
  let isChecking = $state(false);
  let showValidationWarning = $state(false);
  let validationError = $state<string | null>(null);
  let confirmingDelete = $state(false);

  // Check if provider is configured
  $effect(() => {
    if (!clientState.currentSpace) return;

    const customConfigs = clientState.currentSpace.getCustomProviders();
    const allProviders = getActiveProviders(customConfigs);
    const activeProvider = allProviders.find((p) => p.id === provider.id);

    isConfigured = !!activeProvider;
    if (isConfigured) {
      checkConfigurationAndStatus();
    }
  });

  async function checkConfigurationAndStatus() {
    if (!clientState.currentSpace) return;

    isChecking = true;
    showValidationWarning = false;
    validationError = null;

    try {
      const customConfigs =
        clientState.currentSpace.getCustomProviders();
      const allProviders = getActiveProviders(customConfigs);
      const activeProvider = allProviders.find((p) => p.id === provider.id);

      if (!activeProvider) {
        isConfigured = false;
        return;
      }

      // Check provider status
      const status =
        await clientState.currentSpace.getModelProviderStatus(
          provider.id,
        );

      if (status === "invalid") {
        showValidationWarning = true;
        validationError =
          "API key validation failed. The key might be invalid or expired.";
      }
    } catch (error) {
      showValidationWarning = true;
      validationError =
        error instanceof Error ? error.message : "Unknown error occurred";
    } finally {
      isChecking = false;
    }
  }

  function handleEdit() {
    isEditing = true;
  }

  function handleSave() {
    isEditing = false;
    checkConfigurationAndStatus();
  }

  function handleDelete() {
    confirmingDelete = true;
  }

  function cancelDelete() {
    confirmingDelete = false;
  }

  function deleteProvider() {
    if (!clientState.currentSpace) return;

    clientState.currentSpace.removeCustomProvider(provider.id);
    onDeleted?.();
  }
</script>

<div
  class="card border border-surface-100-900 p-2 flex items-center gap-3 h-full"
  class:border-token={isConfigured && !showValidationWarning}
  class:border-warning-500={showValidationWarning}
>
  {#if !isEditing}
    <div
      class="w-10 h-10 bg-white flex flex-shrink-0 items-center justify-center rounded"
    >
      <img src="/providers/openai-like.png" alt={provider.name} class="w-4/5" />
    </div>

    <div class="flex items-center justify-between flex-grow">
      <div class="flex items-center gap-2">
        <span class="font-semibold">{provider.name}</span>
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

      {#if !confirmingDelete}
        <div class="flex gap-2">
          <button
            class="btn btn-sm preset-outlined-surface-500"
            onclick={handleEdit}
            title="Edit provider"
          >
            <Pencil size={14} />
            <span>Edit</span>
          </button>
          <button
            class="btn btn-sm preset-outlined-error-500"
            onclick={handleDelete}
            title="Delete provider"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      {:else}
        <div class="flex items-center gap-2">
          <div class="text-sm text-error-500">Delete?</div>
          <button
            class="btn btn-sm preset-filled-error-500"
            onclick={deleteProvider}
          >
            Confirm
          </button>
          <button
            class="btn btn-sm preset-outlined-surface-500"
            onclick={cancelDelete}
          >
            Cancel
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="w-full">
      <CustomProviderForm
        providerId={provider.id}
        onSave={handleSave}
        onCancel={() => (isEditing = false)}
      />
    </div>
  {/if}
</div>
