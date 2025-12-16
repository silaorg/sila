<script lang="ts">
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const isElectron = typeof window !== "undefined" && Boolean((window as any).electronFileSystem);
  const clientState = useClientState();

  let isChecking = $state(false);
  const shellVersion = $derived(clientState.appVersions?.shell?.version ?? "");

  async function checkForLatestRelease() {
    if (!isElectron) return;

    isChecking = true;
    try {
      // Refresh central state (used for display) before checking updates
      if ((window as any).electronFileSystem?.getAppVersions) {
        clientState.appVersions = await (window as any).electronFileSystem.getAppVersions();
      }
      await (window as any).electronFileSystem.checkForUpdates();
    } catch (error) {
      console.error("Error checking for latest release:", error);
    } finally {
      isChecking = false;
    }
  }

  // Removed manual download UI; updates are coordinated by main updater

  onMount(() => {
    if (isElectron) {
      checkForLatestRelease();
    }
  });
</script>

<div class="flex h-full flex-col gap-6 p-4" data-component="desktop-updates">
  {#if isElectron}
    <section class="space-y-4">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-1">
          <h2 class="text-base font-medium text-surface-900-100-token">Desktop Updates</h2>
          <p class="text-xs text-surface-600-300-token">
            Current version:
            <span class="font-mono text-surface-900-100-token">{shellVersion || "—"}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="btn btn-sm preset-filled"
            onclick={checkForLatestRelease}
            disabled={isChecking}
          >
            {isChecking ? "Checking..." : "Check for Updates"}
          </button>
        </div>
      </header>
    </section>
  {:else}
    <div class="rounded border border-surface-200-700-token bg-surface-50-800-token p-3 text-xs text-surface-600-300-token">
      Desktop updates are only available in the desktop app.
    </div>
  {/if}
</div>

