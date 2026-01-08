<script lang="ts">
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from "@sila/core";

  const clientState = useClientState();

  let { compact = false }: { compact?: boolean } = $props();

  let selected: SupportedLanguage = $state(i18n.language);

  $effect(() => {
    // Keep selector in sync when workspace changes and language is applied elsewhere
    selected = i18n.language;
  });

  $effect(() => {
    // When workspace changes, prefer its saved language (if any) from the space tree
    const space = clientState.currentSpace;
    const rootVertex = space?.tree.root;
    if (!rootVertex) return;

    const applyFromVertex = () => {
      const lang = rootVertex.getProperty("language") as
        | SupportedLanguage
        | undefined
        | null;
      if (lang && (SUPPORTED_LANGUAGES as ReadonlyArray<string>).includes(lang)) {
        selected = lang;
        // Ensure UI texts follow the workspace language, even on initial load.
        if (i18n.language !== lang) {
          i18n.language = lang;
        }
      }
    };

    applyFromVertex();

    const unobserve = rootVertex.observe((events) => {
      if (events.some((e) => e.type === "property")) {
        applyFromVertex();
      }
    });

    return () => unobserve();
  });

  async function handleChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const next = select.value as SupportedLanguage;
    selected = next;
    i18n.language = next;

    const space = clientState.currentSpace;
    const rootVertex = space?.tree.root;
    if (!space || !rootVertex) {
      // @TODO: decide behavior when no workspace is loaded (probably store app-level language)
      return;
    }

    // Persist to space tree (syncs via CRDT)
    rootVertex.setProperty("language", next);
  }
</script>

<select
  class="select rounded-container {compact ? 'text-xs py-1 px-2 h-9 max-w-44' : ''}"
  value={selected}
  onchange={handleChange}
>
  {#each SUPPORTED_LANGUAGES as lang}
    <option value={lang}>{LANGUAGE_NAMES[lang]}</option>
  {/each}
</select>
