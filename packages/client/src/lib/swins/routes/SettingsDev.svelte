<script lang="ts">
  import { isDevMode } from "@sila/client/state/devMode";
  import { i18n } from "@sila/client";
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import AppUpdates from "./AppUpdates.svelte";
  import { buildChatSearchEntries } from "@sila/client/utils/chatSearch";
  import RefreshCcw from "lucide-svelte/icons/refresh-ccw";

  const clientState = useClientState();
  const versions = $derived(clientState.appVersions);
  const shellVersion = $derived(versions?.shell?.version ?? null);
  const clientVersion = $derived(versions?.client?.version ?? null);
  const clientVersionSource = $derived(versions?.client?.source ?? null);
  let isIndexing = $state(false);
  let indexError = $state<string | null>(null);
  let lastIndexedAt = $state<number | null>(null);

  async function rebuildSearchIndex() {
    if (!clientState.currentSpace) return;
    isIndexing = true;
    indexError = null;

    try {
      await buildChatSearchEntries(clientState.currentSpace);
      lastIndexedAt = Date.now();
    } catch (error) {
      indexError = error instanceof Error ? error.message : String(error);
    } finally {
      isIndexing = false;
    }
  }

  function formatDate(value?: number): string {
    if (!value) return "";
    const date = new Date(value);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1">
    <div class="space-y-4">
      <section class="space-y-2">
        <div class="text-sm font-medium">{i18n.texts.devPanel.versionLabel}</div>
        <div class="grid gap-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div>{i18n.texts.devPanel.shellLabel}</div>
            <div class="font-mono">{shellVersion || "—"}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div>{i18n.texts.devPanel.clientLabel}</div>
            <div class="flex items-center gap-2">
              <div class="font-mono">{clientVersion || "—"}</div>
              {#if clientVersionSource}
                <div class="text-xs">({clientVersionSource})</div>
              {/if}
            </div>
          </div>
        </div>
      </section>

      <AppUpdates />

      <section class="space-y-2">
        <div class="text-sm font-medium">Search index</div>
        <p class="text-sm text-surface-500">
          Rebuild the local chat search index for the current workspace.
        </p>
        <div class="flex items-center gap-3">
          <button
            class="btn btn-sm preset-tonal"
            type="button"
            onclick={rebuildSearchIndex}
            disabled={isIndexing || !clientState.currentSpace}
          >
            <RefreshCcw size={16} />
            {isIndexing ? "Indexing" : "Rebuild"}
          </button>
          {#if lastIndexedAt}
            <span class="text-xs text-surface-500">
              Last indexed {formatDate(lastIndexedAt)}
            </span>
          {/if}
        </div>
        {#if indexError}
          <p class="text-sm text-error-500">{indexError}</p>
        {/if}
      </section>

      <label class="label">
        <span>{i18n.texts.settingsPage.developers.toggleDevMode}</span>
        <input type="checkbox" class="checkbox" bind:checked={$isDevMode} />
      </label>
    </div>
  </div>
</div>
