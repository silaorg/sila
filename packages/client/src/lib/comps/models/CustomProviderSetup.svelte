<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { CustomProviderConfig } from "@sila/core";
  const clientState = useClientState();
  import { XCircle } from "lucide-svelte";
  import { i18n } from "@sila/client";

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
  }: {
    providerId?: string;
    onSave?: (id: string) => void;
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
    apiKey = clientState.currentSpace?.getServiceApiKey(providerId) || "";

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

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!clientState.currentSpace) return;

    isSubmitting = true;
    validationError = null;

    try {
      // Generate a unique ID for the provider
      const id = providerId || `custom-${Date.now()}`;

      // Parse custom headers
      let parsedHeaders: Record<string, string> | undefined;
      if (customHeaders.trim()) {
        try {
          parsedHeaders = Object.fromEntries(
            customHeaders
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line)
              .map((line) => {
                const [key, ...valueParts] = line.split(":");
                return [key.trim(), valueParts.join(":").trim()];
              }),
          );
        } catch (e) {
          validationError =
            i18n.texts.customProviderSetup.invalidHeadersFormat;
          return;
        }
      }

      const config: CustomProviderConfig = {
        id,
        type: "cloud",
        name,
        baseApiUrl,
        apiKey,
        modelId,
        customHeaders: parsedHeaders,
      };

      clientState.currentSpace.saveModelProviderConfig(config);
      onSave(id);
    } catch (e) {
      validationError = i18n.texts.customProviderSetup.saveError;
      console.error(e);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="h-full overflow-y-auto p-4 space-y-4">
  <h4 class="h5 mb-4">
    {providerId
      ? i18n.texts.customProviderSetup.titleEdit
      : i18n.texts.customProviderSetup.titleAdd}
  </h4>

  <form onsubmit={handleSubmit} class="space-y-4">
    <div class="space-y-2">
      <label for="name" class="label">
        {i18n.texts.customProviderSetup.labelProviderName}
      </label>
      <input
        type="text"
        id="name"
        bind:value={name}
        class="input"
        placeholder={i18n.texts.customProviderSetup.placeholderName}
        required
      />
    </div>

    <div class="space-y-2">
      <label for="baseApiUrl" class="label">
        {i18n.texts.customProviderSetup.labelBaseApiUrl}
      </label>
      <input
        type="url"
        id="baseApiUrl"
        bind:value={baseApiUrl}
        class="input"
        placeholder={i18n.texts.customProviderSetup.placeholderBaseApiUrl}
        required
      />
    </div>

    <div class="space-y-2">
      <label for="apiKey" class="label">
        {i18n.texts.customProviderSetup.labelApiKey}
      </label>
      <input
        type="password"
        id="apiKey"
        bind:value={apiKey}
        class="input"
        placeholder={i18n.texts.customProviderSetup.placeholderApiKey}
        required
      />
    </div>

    <div class="space-y-2">
      <label for="modelId" class="label">
        {i18n.texts.customProviderSetup.labelModelId}
      </label>
      <input
        type="text"
        id="modelId"
        bind:value={modelId}
        class="input"
        placeholder={i18n.texts.customProviderSetup.placeholderModelId}
        required
      />
    </div>

    <div class="space-y-2">
      <label for="customHeaders" class="label">
        {i18n.texts.customProviderSetup.labelCustomHeaders}
      </label>
      <textarea
        id="customHeaders"
        bind:value={customHeaders}
        class="input"
        placeholder={i18n.texts.customProviderSetup.placeholderHeaders}
        rows="3"
      ></textarea>
      <p class="text-sm text-surface-500">
        {i18n.texts.customProviderSetup.headersHint}
      </p>
    </div>

    {#if validationError}
      <div class="flex items-center gap-2 text-warning-500">
        <XCircle size={16} />
        <span>{validationError}</span>
      </div>
    {/if}

    <div class="flex flex-col gap-2">
      <button
        type="submit"
        class="btn preset-outlined-primary-500 w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? i18n.texts.actions.saving : i18n.texts.actions.save}
      </button>
      <button
        type="button"
        class="btn preset-outlined-surface-500 w-full"
        onclick={() => clientState.layout.swins.pop()}
      >
        {i18n.texts.actions.cancel}
      </button>
    </div>
  </form>
</div>
