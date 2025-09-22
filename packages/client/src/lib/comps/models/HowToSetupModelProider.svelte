<script lang="ts">
  import { XCircle } from "lucide-svelte";
  import Link from "../basic/Link.svelte";
  import ModelProviderApiKeyForm from "./ModelProviderApiKeyForm.svelte";
  import type { ModelProvider } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  let { provider }: { provider: ModelProvider } = $props();

  $effect(() => {
    console.log("provider: ", provider);
  });
</script>

<div class="h-full overflow-y-auto p-4 space-y-4">
  <h4 class="h5 mb-4">How to setup {provider.name}</h4>
  {#if provider.id === "openai"}
    <p>
      You will need to enter a key that will allow you to use OpenAI's models.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login for in OpenAI: <Link
            href="https://platform.openai.com">https://platform.openai.com</Link
          >
        </span>
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Add credits to your balance here <Link
            href="https://platform.openai.com/settings/organization/billing/overview"
            >https://platform.openai.com/settings/organization/billing/overview</Link
          ></span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Go to <Link href="https://platform.openai.com/api-keys"
            >https://platform.openai.com/api-keys</Link
          > and create a new secret key.</span
        >
      </li>
      <li>
        <span>4.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else if provider.id === "anthropic"}
    <p>
      You will need to enter a key that will allow you to use Anthropic's
      models.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login for in Anthropic: <Link
            href="https://console.anthropic.com/"
            >https://console.anthropic.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Go to <Link href="https://console.anthropic.com/settings/keys"
            >https://console.anthropic.com/settings/keys</Link
          > and create a new key.</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else if provider.id === "groq"}
    <p>
      You will need to enter a key that will allow you to use Groq's models.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login for in Groq: <Link href="https://console.groq.com/"
            >https://console.groq.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Go to <Link href="https://console.groq.com/keys"
            >https://console.groq.com/keys</Link
          > and create an API key</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else if provider.id === "deepseek"}
    <p>
      You will need to enter a key that will allow you to use DeepSeek's models.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login for DeepSeek: <Link
            href="https://platform.deepseek.com/"
            >https://platform.deepseek.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Go to <Link href="https://platform.deepseek.com/api_keys"
            >https://platform.deepseek.com/api_keys</Link
          > and create an API key</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else if provider.id === "google"}
    <p>
      You will need to enter a key that will allow you to use Google Gemini
      models.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login to Google AI Studio: <Link
            href="https://makersuite.google.com/"
            >https://makersuite.google.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Go to <Link href="https://makersuite.google.com/app/apikey"
            >https://makersuite.google.com/app/apikey</Link
          > and create an API key</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else if provider.id === "xai"}
    <p>You will need to enter a key that will allow you to use xAI's models.</p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login to xAI: <Link href="https://console.x.ai/"
            >https://console.x.ai/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Create a team and go to the API keys page.</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else if provider.id === "cohere"}
    <p>
      You will need to enter a key that will allow you to use Cohere's models.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login to Cohere: <Link
            href="https://dashboard.cohere.com/"
            >https://dashboard.cohere.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Go to <Link href="https://dashboard.cohere.com/api-keys"
            >https://dashboard.cohere.com/api-keys</Link
          > and create an API key</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else if provider.id === "mistral"}
    <p>
      You will need to enter a key that will allow you to use Mistral's models.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login to Mistral AI: <Link
            href="https://console.mistral.ai/">https://console.mistral.ai/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Go to <Link href="https://console.mistral.ai/api-keys/"
            >https://console.mistral.ai/api-keys/</Link
          > and create an API key</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else if provider.id === "ollama"}
    <p>
      You will need to install and run Ollama to use its models. You can run it
      locally and Sila will connect to it.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Download Ollama from <Link href="https://ollama.com/"
            >https://ollama.com/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Install Ollama and setup a model you would like to use.</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto">Go back here after you start it.</span>
      </li>
    </ol>
  {:else if provider.id === "openrouter"}
    <p>
      You will need to enter a key that will allow you to use OpenRouter's unified API to access hundreds of AI models.
    </p>
    <ol class="list">
      <li>
        <span>1.</span>
        <span class="flex-auto"
          >Sign up or login to OpenRouter: <Link
            href="https://openrouter.ai/"
            >https://openrouter.ai/</Link
          ></span
        >
      </li>
      <li>
        <span>2.</span>
        <span class="flex-auto"
          >Go to your account settings and navigate to the API keys section to create a new API key.</span
        >
      </li>
      <li>
        <span>3.</span>
        <span class="flex-auto"
          >Paste the key here and wait for it to validate.</span
        >
      </li>
    </ol>
  {:else}
    <p>No setup instructions available for this provider.</p>
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
    }}>Ok</button
  >
</div>
