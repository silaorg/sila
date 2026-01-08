<script lang="ts">
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import SettingsSidebar from "./SettingsSidebar.svelte";

  const clientState = useClientState();
  const pointer = $derived(clientState.currentSpaceState?.pointer ?? null);
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1 space-y-4">
    <div class="space-y-3">
      <div class="text-sm font-medium">{i18n.texts.settingsPage.workspacePrivacySync.storageTitle}</div>
      {#if pointer}
        <div class="text-sm">
          <div class="text-surface-600-300">
            {i18n.texts.settingsPage.workspacePrivacySync.workspaceLocationLabel}
          </div>
          <div class="font-mono break-all">{pointer.uri}</div>
        </div>
      {:else}
        <div class="text-sm text-surface-600-300">
          {i18n.texts.settingsPage.workspacePrivacySync.noWorkspaceLoaded}
        </div>
      {/if}

      <div class="text-xs text-surface-600-300">
        {i18n.texts.settingsPage.workspacePrivacySync.syncPlaceholder}
      </div>
    </div>
  </div>
</div>
