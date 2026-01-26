<script lang="ts">
  import { XCircle } from "lucide-svelte";
  import { Markdown } from "@markpage/svelte";
  import { chatMarkdownOptions } from "../markdown/chatMarkdownOptions";
  import ModelProviderApiKeyForm from "./ModelProviderApiKeyForm.svelte";
  import type { ModelProvider } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  let { provider }: { provider: ModelProvider } = $props();

  $effect(() => {
    console.log("provider: ", provider);
  });

  const setupMarkdown = $derived.by(() => {
    switch (provider.id) {
      case "openai":
        return i18n.texts.modelProviderSetup.openai;
      case "anthropic":
        return i18n.texts.modelProviderSetup.anthropic;
      case "groq":
        return i18n.texts.modelProviderSetup.groq;
      case "deepseek":
        return i18n.texts.modelProviderSetup.deepseek;
      case "google":
        return i18n.texts.modelProviderSetup.google;
      case "xai":
        return i18n.texts.modelProviderSetup.xai;
      case "cohere":
        return i18n.texts.modelProviderSetup.cohere;
      case "mistral":
        return i18n.texts.modelProviderSetup.mistral;
      case "ollama":
        return i18n.texts.modelProviderSetup.ollama;
      case "openrouter":
        return i18n.texts.modelProviderSetup.openrouter;
      case "exa":
        return i18n.texts.modelProviderSetup.exa;
      case "falai":
        return i18n.texts.modelProviderSetup.falai;
      default:
        return i18n.texts.modelProviderSetup.noInstructions;
    }
  });
</script>

<div class="h-full overflow-y-auto p-4 space-y-4">
  <h4 class="h5 mb-4">{i18n.texts.modelProviderSetup.title(provider.name)}</h4>
  <div class="chat-message">
    <Markdown source={setupMarkdown} options={chatMarkdownOptions} />
  </div>
  {#if provider.access === "cloud"}
    <ModelProviderApiKeyForm
      id={provider.id}
      autofocus={false}
      showCloseButton={false}
      onValidKey={() => {
        clientState.layout.swins.pop();
      }}
    />
  {/if}
  <button
    class="btn preset-outlined-surface-500 mt-4"
    onclick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      clientState.layout.swins.pop();
    }}>{i18n.texts.modelProviderSetup.okButton}</button
  >
</div>
