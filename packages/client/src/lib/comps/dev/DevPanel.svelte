<script lang="ts">
  import { onMount } from "svelte";
  import { isDevMode } from "@sila/client/state/devMode";
  import { spaceInspectorOpen } from "@sila/client/state/devMode";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  const isElectron = typeof window !== "undefined" && (window as any).electronFileSystem;

  let currentVersion: string = $state("...");

  onMount(async () => {
    if (!isElectron) return;

    try {
      const version = await (window as any).electronFileSystem.getCurrentBuildVersion();
      if (version) {
        currentVersion = version;
      }
    } catch (error) {
      console.error("Failed to load current build version", error);
    }
  });

  function openDesktopUpdates() {
    if (!isElectron) return;

    clientState.layout.swins.open("desktop-updates", {}, "Desktop Updates");
  }
</script>

<div class="flex flex-col gap-4 p-2">
  <div class="flex gap-4 items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="text-sm text-surface-600-300-token">🚧 Sila {currentVersion} in Dev Mode</div>
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
