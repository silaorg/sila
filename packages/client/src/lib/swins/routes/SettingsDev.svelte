<script lang="ts">
  import { isDevMode } from "@sila/client/state/devMode";
  import { txtStore } from "@sila/client/state/txtStore";
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

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
      <label class="label">
        <span>{$txtStore.settingsPage.developers.toggleDevMode}</span>
        <input
          type="checkbox"
          class="checkbox"
          bind:checked={$isDevMode}
        />
      </label>

      <div class="rounded border border-surface-200-700-token bg-surface-50-800-token p-3">
        <div class="text-xs text-surface-600-300-token">Version</div>
        <div class="mt-2 grid gap-2 text-xs">
          <div class="flex items-center justify-between gap-3">
            <div class="text-surface-600-300-token">Shell</div>
            <div class="font-mono text-surface-900-100-token">{shellVersion || "—"}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-surface-600-300-token">Client</div>
            <div class="flex items-center gap-2">
              <div class="font-mono text-surface-900-100-token">{clientVersion || "—"}</div>
              {#if clientVersionSource}
                <div class="text-[10px] text-surface-600-300-token">({clientVersionSource})</div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

