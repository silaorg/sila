<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { CustomProviderConfig } from "@sila/core";
  const clientState = useClientState();

  let name = $state("");
  let baseApiUrl = $state("");
  let apiKey = $state("");
  let modelId = $state("gpt-3.5-turbo");
  let customHeaders = $state("");
  let isSubmitting = $state(false);
  let validationError = $state<string | null>(null);

  let {
    providerId, // If provided, we're editing an existing provider
    onSave = () => {},
    onCancel = () => {},
  }: {
    providerId?: string;
    onSave?: (id: string) => void;
    onCancel?: () => void;
  } = $props();

  // Load existing provider data if we're editing
  $effect(() => {
    if (!providerId || !clientState.currentSpace) return;

    const config = clientState.currentSpace?.getModelProviderConfig(
      providerId,
    ) as CustomProviderConfig | undefined;
    if (!config) return;

    name = config.name;
    baseApiUrl = config.baseApiUrl;
    modelId = config.modelId;
    apiKey =
      clientState.currentSpace?.getServiceApiKey(providerId) || "";

    if (config.customHeaders) {
      try {
        customHeaders = Object.entries(config.customHeaders)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
      } catch (e) {
        customHeaders = "";
      }
    }
  });

  function validate(): boolean {
    validationError = null;

    if (!name.trim()) {
      validationError = "Provider name is required";
      return false;
    }

    if (!baseApiUrl.trim()) {
      validationError = "API URL is required";
      return false;
    }

    try {
      // Check if URL is valid
      new URL(baseApiUrl);
    } catch (e) {
      validationError = "Invalid API URL format";
      return false;
    }

    if (!apiKey.trim()) {
      validationError = "API key is required";
      return false;
    }

    if (!modelId.trim()) {
      validationError = "Model ID is required";
      return false;
    }

    return true;
  }

  function parseCustomHeaders(): Record<string, string> | undefined {
    if (!customHeaders.trim()) return undefined;

    try {
      const headers: Record<string, string> = {};
      customHeaders.split("\n").forEach((line) => {
        const [key, ...valueParts] = line.split(":");
        if (key && valueParts.length) {
          const value = valueParts.join(":").trim();
          if (value) {
            headers[key.trim()] = value;
          }
        }
      });
      return Object.keys(headers).length > 0 ? headers : undefined;
    } catch (e) {
      console.error("Failed to parse custom headers", e);
      return undefined;
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!validate() || !clientState.currentSpace) return;

    isSubmitting = true;
    try {
      const config: Omit<CustomProviderConfig, "id" | "type"> = {
        name,
        baseApiUrl,
        apiKey,
        modelId,
        customHeaders: parseCustomHeaders(),
      };

      let id: string;
      if (providerId) {
        // Update existing provider
        clientState.currentSpace.updateCustomProvider(
          providerId,
          config,
        );
        id = providerId;
      } else {
        // Add new provider
        id = clientState.currentSpace.addCustomProvider(config) || "";
      }

      onSave(id);
    } catch (e) {
      console.error("Failed to save custom provider", e);
      validationError = `Failed to save: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="card p-4 space-y-4">
  <h3 class="h4">
    {providerId ? "Edit" : "Add"} Custom OpenAI-compatible Provider
  </h3>

  <form onsubmit={handleSubmit} class="space-y-4">
    <!-- Provider Name -->
    <label class="label">
      <span class="label-text">Provider Name*</span>
      <input
        class="input"
        type="text"
        placeholder="My Custom Provider"
        bind:value={name}
        required
      />
    </label>

    <!-- Base API URL -->
    <label class="label">
      <span class="label-text">API URL*</span>
      <input
        class="input"
        type="url"
        placeholder="https://api.example.com/v1"
        bind:value={baseApiUrl}
        required
      />
      <span class="text-xs opacity-60"
        >The base URL for API calls, should be compatible with OpenAI API</span
      >
    </label>

    <!-- API Key -->
    <label class="label">
      <span class="label-text">API Key*</span>
      <input
        class="input"
        type="password"
        placeholder="sk-..."
        bind:value={apiKey}
        required
      />
    </label>

    <!-- Model ID -->
    <label class="label">
      <span class="label-text">Model ID*</span>
      <input
        class="input"
        type="text"
        placeholder="gpt-3.5-turbo"
        bind:value={modelId}
        required
      />
      <span class="text-xs opacity-60"
        >Specify the model ID that this provider requires</span
      >
    </label>

    <!-- Custom Headers -->
    <label class="label">
      <span class="label-text">Custom Headers (optional)</span>
      <textarea
        class="textarea rounded-container"
        rows="3"
        placeholder="Authorization: Bearer token
Content-Type: application/json"
        bind:value={customHeaders}
      ></textarea>
      <span class="text-xs opacity-60"
        >Enter one header per line in "Key: Value" format</span
      >
    </label>

    {#if validationError}
      <div class="text-error-500">{validationError}</div>
    {/if}

    <div class="flex gap-2 justify-end">
      <button
        type="button"
        class="btn preset-outlined-surface-500"
        onclick={onCancel}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="btn preset-filled-primary-500"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : providerId ? "Update" : "Add"} Provider
      </button>
    </div>
  </form>
</div>
