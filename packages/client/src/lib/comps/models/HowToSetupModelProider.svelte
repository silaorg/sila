<script lang="ts">
  import { XCircle } from "lucide-svelte";
  import Link from "../basic/Link.svelte";
  import ModelProviderApiKeyForm from "./ModelProviderApiKeyForm.svelte";
  import type { ModelProvider } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  let { provider }: { provider: ModelProvider } = $props();

  $effect(() => {
    console.log("provider: ", provider);
  });
</script>

<div class="h-full overflow-y-auto p-4 space-y-4">
  <h4 class="h5 mb-4">{i18n.texts.modelProviderSetup.title(provider.name)}</h4>
  {#if provider.id === "openai"}
    <p>{i18n.texts.modelProviderSetup.openai.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.openai.steps.signup} <Link
            href="https://platform.openai.com">https://platform.openai.com</Link
          >
        </span>
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.openai.steps.addCredits} <Link
            href="https://platform.openai.com/settings/organization/billing/overview"
            >https://platform.openai.com/settings/organization/billing/overview</Link
          ></span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.openai.steps.createKey} <Link href="https://platform.openai.com/api-keys"
            >https://platform.openai.com/api-keys</Link
          ></span
        >
      </li>
      <li>
        <span>4.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.openai.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else if provider.id === "anthropic"}
    <p>{i18n.texts.modelProviderSetup.anthropic.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.anthropic.steps.signup} <Link
            href="https://console.anthropic.com/"
            >https://console.anthropic.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.anthropic.steps.createKey} <Link href="https://console.anthropic.com/settings/keys"
            >https://console.anthropic.com/settings/keys</Link
          ></span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.anthropic.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else if provider.id === "groq"}
    <p>{i18n.texts.modelProviderSetup.groq.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.groq.steps.signup} <Link href="https://console.groq.com/"
            >https://console.groq.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.groq.steps.createKey} <Link href="https://console.groq.com/keys"
            >https://console.groq.com/keys</Link
          ></span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.groq.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else if provider.id === "deepseek"}
    <p>{i18n.texts.modelProviderSetup.deepseek.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.deepseek.steps.signup} <Link
            href="https://platform.deepseek.com/"
            >https://platform.deepseek.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.deepseek.steps.createKey} <Link href="https://platform.deepseek.com/api_keys"
            >https://platform.deepseek.com/api_keys</Link
          ></span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.deepseek.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else if provider.id === "google"}
    <p>{i18n.texts.modelProviderSetup.google.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.google.steps.signup} <Link
            href="https://makersuite.google.com/"
            >https://makersuite.google.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.google.steps.createKey} <Link href="https://makersuite.google.com/app/apikey"
            >https://makersuite.google.com/app/apikey</Link
          ></span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.google.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else if provider.id === "xai"}
    <p>{i18n.texts.modelProviderSetup.xai.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.xai.steps.signup} <Link href="https://console.x.ai/"
            >https://console.x.ai/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto">{i18n.texts.modelProviderSetup.xai.steps.createTeam}</span>
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.xai.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else if provider.id === "cohere"}
    <p>{i18n.texts.modelProviderSetup.cohere.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.cohere.steps.signup} <Link
            href="https://dashboard.cohere.com/"
            >https://dashboard.cohere.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.cohere.steps.createKey} <Link href="https://dashboard.cohere.com/api-keys"
            >https://dashboard.cohere.com/api-keys</Link
          ></span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.cohere.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else if provider.id === "mistral"}
    <p>{i18n.texts.modelProviderSetup.mistral.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.mistral.steps.signup} <Link
            href="https://console.mistral.ai/">https://console.mistral.ai/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.mistral.steps.createKey} <Link href="https://console.mistral.ai/api-keys/"
            >https://console.mistral.ai/api-keys/</Link
          ></span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.mistral.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else if provider.id === "ollama"}
    <p>{i18n.texts.modelProviderSetup.ollama.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.ollama.steps.download} <Link href="https://ollama.com/"
            >https://ollama.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.ollama.steps.install}</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto">{i18n.texts.modelProviderSetup.ollama.steps.returnAfterStart}</span>
      </li>
    </ol>
  {:else if provider.id === "openrouter"}
    <p>{i18n.texts.modelProviderSetup.openrouter.intro}</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.openrouter.steps.signup} <Link
            href="https://openrouter.ai/"
            >https://openrouter.ai/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.openrouter.steps.createKey}</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >{i18n.texts.modelProviderSetup.openrouter.steps.pasteKey}</span
        >
      </li>
    </ol>
  {:else}
    <p>{i18n.texts.modelProviderSetup.noInstructions}</p>
  {/if}
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
