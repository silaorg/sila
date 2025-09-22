<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { ModelProviderLocalConfig } from "@sila/core";
  const clientState = useClientState();
  import { XCircle, CheckCircle, CircleAlert } from "lucide-svelte/icons";
  import { timeout } from "@sila/core";

  let {
    id,
    onValidAddress,
    onBlur = () => {},
    onClose = () => {},
    autofocus = true,
  } = $props<{
    id: string;
    onValidAddress: (address: string) => void;
    onBlur?: (address: string) => void;
    onClose?: () => void;
    autofocus?: boolean;
  }>();

  const defaultAddress = "http://localhost:11434";
  let address = $state(defaultAddress);
  let inputElement = $state<HTMLInputElement | null>(null);
  let checkingAddress = $state(false);
  let addressIsInvalid = $state(false);

  let cancelTimeout: (() => void) | null = null;

  async function checkAndSaveAddress() {
    checkingAddress = true;
    try {
      // If address is empty, use default
      const addressToCheck = address || defaultAddress;
      const res = await fetch(`${addressToCheck}/api/tags`);
      addressIsInvalid = false;
      if (res.status === 200) {
        const config: ModelProviderLocalConfig = {
          id,
          type: "local",
          apiUrl: addressToCheck,
        };
        clientState.currentSpace?.saveModelProviderConfig(config);
        onValidAddress(addressToCheck);
        onClose();
        return true;
      }
    } catch (e) {
      addressIsInvalid = true;
    } finally {
      checkingAddress = false;
    }
    return false;
  }

  function handleAddressChange() {
    if (cancelTimeout) cancelTimeout();
    cancelTimeout = timeout(async () => {
      await checkAndSaveAddress();
    }, 500); // Debounce for 500ms
  }

  async function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      await checkAndSaveAddress();
    }
  }

  function handleBlur() {
    onBlur(address);
  }

  $effect(() => {
    if (autofocus && inputElement) {
      inputElement.focus();
    }
  });
</script>

<div class="relative">
  <input
    class="input w-full pr-16 transition-all duration-200 {checkingAddress
      ? 'focus:ring-primary-500/50 animate-[pulse_1.5s_ease-in-out_infinite]'
      : addressIsInvalid
        ? 'focus:ring-warning-500'
        : ''}"
    type="text"
    bind:value={address}
    bind:this={inputElement}
    oninput={handleAddressChange}
    onblur={handleBlur}
    onkeydown={handleKeyDown}
    placeholder={address ? "" : defaultAddress}
  />
  {#if !checkingAddress && !addressIsInvalid}
    <span class="absolute right-9 top-1/2 -translate-y-1/2">
      <CheckCircle size={18} class="text-success-500" />
    </span>
  {:else if addressIsInvalid}
    <span class="absolute right-9 top-1/2 -translate-y-1/2">
      <CircleAlert size={18} class="text-warning-500" />
    </span>
  {/if}
  <button
    class="absolute right-2.5 top-1/2 -translate-y-1/2"
    onclick={async () => {
      // Try to save if address is valid before closing
      if (!(await checkAndSaveAddress())) {
        onClose();
      }
    }}
  >
    <XCircle size={18} />
  </button>
</div>
