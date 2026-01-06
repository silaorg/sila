<script lang="ts">
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import WorkspaceLanguageSwitcher from "@sila/client/comps/settings/WorkspaceLanguageSwitcher.svelte";

  const clientState = useClientState();
  const pointer = $derived(clientState.currentSpaceState?.pointer ?? null);
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1 space-y-4">
    <div class="space-y-4">
      <div class="grid gap-2">
        <div class="text-sm font-medium">About this workspace</div>
        {#if pointer}
          <div class="text-sm grid gap-1">
            <div><span class="text-surface-600-300">Name:</span> {pointer.name || "—"}</div>
            <div><span class="text-surface-600-300">ID:</span> <span class="font-mono">{pointer.id}</span></div>
            <div><span class="text-surface-600-300">Location:</span> <span class="font-mono">{pointer.uri}</span></div>
          </div>
        {:else}
          <div class="text-sm text-surface-600-300">
            No workspace loaded.
          </div>
        {/if}
      </div>

      <label class="label">
        <span>{i18n.texts.settingsPage.appearance.language}</span>
        <WorkspaceLanguageSwitcher />
      </label>

      <div class="text-xs text-surface-600-300">
        @TODO: workspace name/icon, workspace-specific appearance summary, other preferences.
      </div>
    </div>
  </div>
</div>

