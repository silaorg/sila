<script lang="ts">
  import { i18n } from "@sila/client";
  import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from "@sila/core";

  let { compact = false }: { compact?: boolean } = $props();

  function handleLanguageChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    i18n.language = select.value as SupportedLanguage;
  }
</script>

<select
  class="select rounded-container {compact ? 'text-xs py-1 px-2 h-9 max-w-44' : ''}"
  value={i18n.language}
  onchange={handleLanguageChange}
>
  {#each SUPPORTED_LANGUAGES as lang}
    <option value={lang}>{LANGUAGE_NAMES[lang]}</option>
  {/each}
</select>
