<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import SettingsSidebar from "./SettingsSidebar.svelte";

  const clientState = useClientState();
  const pointer = $derived(clientState.currentSpaceState?.pointer ?? null);
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1 space-y-4">
    <div class="space-y-3">
      <div class="text-sm font-medium">Storage</div>
      {#if pointer}
        <div class="text-sm">
          <div class="text-surface-600-300">Workspace location:</div>
          <div class="font-mono break-all">{pointer.uri}</div>
        </div>
      {:else}
        <div class="text-sm text-surface-600-300">No workspace loaded.</div>
      {/if}

      <div class="text-xs text-surface-600-300">
        @TODO: show sync provider/status, what gets synced, export defaults, retention, attachment policy.
      </div>
    </div>
  </div>
</div>

