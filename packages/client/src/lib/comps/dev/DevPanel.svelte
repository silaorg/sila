<script lang="ts">
  import { isDevMode } from "@sila/client/state/devMode";
  import { spaceInspectorOpen } from "@sila/client/state/devMode";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  const clientState = useClientState();

  const isElectron = typeof window !== "undefined" && (window as any).electronFileSystem;

  function openDesktopUpdates() {
    if (!isElectron) return;

    clientState.layout.swins.open(swinsLayout.desktopUpdates.key, {}, "Desktop Updates");
  }
</script>

<div class="flex flex-col gap-4 p-2">
  <div class="flex gap-4 items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="text-sm text-surface-600-300-token">🚧 Sila {clientState.appVersion || "…"} in Dev Mode</div>
      <button class="btn btn-sm variant-soft" onclick={() => $isDevMode = false}>Exit Dev Mode</button>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn btn-sm variant-soft" onclick={() => $spaceInspectorOpen ? ($spaceInspectorOpen = false) : ($spaceInspectorOpen = true)}>
        {$spaceInspectorOpen ? 'Close Space Inspector' : 'Open Space Inspector'}
      </button>
      {#if isElectron}
        <button
          class="btn btn-sm variant-filled"
          onclick={openDesktopUpdates}
        >
          Desktop Updates
        </button>
      {/if}
    </div>
  </div>
</div>
