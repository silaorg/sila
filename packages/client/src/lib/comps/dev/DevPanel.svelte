<script lang="ts">
  import { isDevMode } from "@sila/client/state/devMode";
  import { spaceInspectorOpen } from "@sila/client/state/devMode";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  const isElectron = typeof window !== "undefined" && (window as any).electronFileSystem;

  function openDesktopUpdates() {
    if (!isElectron) return;

    clientState.layout.swins.open("desktop-updates", {}, "Desktop Updates");
  }
</script>

<div class="flex flex-col gap-4 p-2">
  <div class="flex gap-4 items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="text-sm text-surface-600-300-token">🚧 Sila v1.0.0 in Dev Mode</div>
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
