<script lang="ts" module>
  import { codeToHtml } from "shiki";
  import type { Tokens } from "@markpage/svelte";
  import { Copy, Check } from "lucide-svelte";
  import { timeout } from "@sila/core";
</script>

<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();

  let { token }: { token: Tokens.Code } = $props();
  let lang = $derived(token.lang || "text");
  let isCopied = $state(false);

  // @TODO: remove flashing by caching the generated HTML and updating it when a new resolved generated is ready.

  let generatedHtml = $derived.by(async () => {
    const codeTheme = clientState.theme.actualColorScheme === "dark" ? "github-dark" : "github-light";
    return await generatedHighlightedHtml(token.text, codeTheme, token.lang);
  });

  async function generatedHighlightedHtml(
    source: string,
    codeTheme: string,
    lang?: string
  ): Promise<string | null> {
    try {
      return await codeToHtml(source, {
        lang: lang || "text",
        theme: codeTheme,
      });
    } catch (e) {
      // If the language is not supported, fallback to plaintext
      try {
        return await codeToHtml(source, {
          lang: "text",
          theme: codeTheme,
        });
      } catch (e) {
        return null;
      }
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(token.text);
    isCopied = true;
    timeout(() => {
      isCopied = false;
    }, 2000);
  }
</script>

<div
  class="relative group min-w-0 {lang !== 'text'
    ? '[&_pre]:!pt-10'
    : '[&_pre]:!pr-10'}"
>
  {#if lang !== "text"}
    <div class="absolute left-4 top-3 z-10 flex items-center">
      <span class="text-xs opacity-70 flex items-center">{lang}</span>
    </div>
  {/if}
  <div class="absolute right-4 top-3 z-10 flex items-center">
    <button
      class="flex gap-1 items-center text-xs opacity-70 hover:opacity-100"
      onclick={copyCode}
      aria-label="Copy"
    >
      {#if isCopied}
        <Check size={14} />
      {:else}
        <Copy size={14} />
      {/if}
    </button>
  </div>
  <div class="min-w-0">
    {#await generatedHtml}
      <pre class="overflow-x-auto"><code class="block min-w-fit"
          >{token.text}</code
        ></pre>
    {:then html}
      {#if html}
        {@html html}
      {:else}
        <pre class="overflow-x-auto"><code class="block min-w-fit"
            >{token.text}</code
          ></pre>
      {/if}
    {:catch error}
      Error: {error}
    {/await}
  </div>
</div>
