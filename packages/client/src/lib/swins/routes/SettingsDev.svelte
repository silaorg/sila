<script lang="ts">
  import { isDevMode } from "@sila/client/state/devMode";
  import { txtStore } from "@sila/client/state/txtStore";
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import AppUpdates from "./AppUpdates.svelte";

  const clientState = useClientState();
  const versions = $derived(clientState.appVersions);
  const shellVersion = $derived(versions?.shell?.version ?? null);
  const clientVersion = $derived(versions?.client?.version ?? null);
  const clientVersionSource = $derived(versions?.client?.source ?? null);
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1">
    <div class="space-y-4">
      <section class="space-y-2">
        <div class="text-sm font-medium">Version</div>
        <div class="grid gap-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div>Shell</div>
            <div class="font-mono">{shellVersion || "—"}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div>Client</div>
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

      <label class="label">
        <span>{$txtStore.settingsPage.developers.toggleDevMode}</span>
        <input type="checkbox" class="checkbox" bind:checked={$isDevMode} />
      </label>
    </div>
  </div>
</div>
