<script lang="ts">
  import { CheckCircle, CircleAlert, XCircle } from "lucide-svelte/icons";
  import { onMount } from "svelte";
  import { timeout } from "@sila/core";
  import type {
    ModelProviderCloudConfig,
    ModelProviderConfig,
  } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { validateKey } from "@sila/core";
  const clientState = useClientState();

  let {
    id,
    onValidKey,
    onBlur = () => {},
    onClose = () => {},
    autofocus = true,
    showCloseButton = true,
  } = $props<{
    id: string;
    onValidKey: (key: string) => void;
    onBlur?: (key: string) => void;
    onClose?: () => void;
    autofocus?: boolean;
    showCloseButton?: boolean;
  }>();

  let apiKey = $state("");
  let apiKeyIsValid = $state(false);
  let inputElement = $state<HTMLInputElement | null>(null);
  let cancelTimeout: (() => void) | null = null;
  let checkingKey = $state(false);
  let config = $state<ModelProviderConfig | null>(null);

  let showWarning = $derived(
    !checkingKey && !apiKeyIsValid && apiKey.length > 6,
  );

  function saveCloudProviderWithApiKey(apiKey: string) {
    if (!clientState.currentSpace) return false;
    
    config = {
      id: id,
      type: "cloud",
      apiKey,
    } as ModelProviderCloudConfig;

    clientState.currentSpace?.saveModelProviderConfig(config);
    return true;
  }

  async function handleApiKeyChange() {
    checkingKey = true;
    if (cancelTimeout) cancelTimeout();
    cancelTimeout = timeout(async () => {
      try {
        apiKeyIsValid = await validateKey(id, apiKey);
        if (apiKeyIsValid) {
          if (saveCloudProviderWithApiKey(apiKey)) {
            onValidKey(apiKey);
            onClose();
          }
        }
      } finally {
        checkingKey = false;
      }
    }, 500);
  }

  function handleBlur() {
    onBlur(apiKey);
  }

  onMount(() => {
    if (autofocus && inputElement) {
      inputElement.focus();
    }
  });
</script>

<div
  class="relative"
  class:input-success={apiKeyIsValid}
  class:input-warning={showWarning}
>
  <input
    class="input w-full pr-16 transition-all duration-200 {checkingKey ? 'focus:ring-primary-500/50 animate-[pulse_1.5s_ease-in-out_infinite]' : showWarning ? 'focus:ring-warning-500' : ''}"
    type="password"
    bind:value={apiKey}
    bind:this={inputElement}
    oninput={handleApiKeyChange}
    onblur={handleBlur}
  />
  <div class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-2.5">
    <div class="w-6 flex justify-center">
      {#if apiKeyIsValid}
        <CheckCircle size={18} class="text-success-500" />
      {:else if showWarning}
        <CircleAlert size={18} class="text-warning-500" />
      {/if}
    </div>
    {#if showCloseButton}
      <button onclick={onClose}>
        <XCircle size={18} />
      </button>
    {/if}
  </div>
</div>
