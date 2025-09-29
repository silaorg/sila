<script lang="ts">
  import { onMount } from "svelte";

  type DesktopBuild = {
    version: string;
    downloadUrl: string;
    publishedAt: string;
    releaseTag?: string;
    size?: number;
  };

  type UpdateCoordinatorState = {
    reason?: string;
    priority?: string;
    useFullAppUpdate?: boolean;
    useClientBundleUpdate?: boolean;
    fullAppUpdate?: boolean;
    clientBundleUpdate?: boolean;
    dialogShown?: boolean;
  } | null;

  type LatestRelease = {
    version: string;
    downloadUrl: string;
    publishedAt: string;
    size?: number;
  } | null;

  const isElectron = typeof window !== "undefined" && Boolean((window as any).electronFileSystem);

  let latestRelease: LatestRelease = $state(null);
  let availableBuilds: string[] = $state([]);
  let allAvailableDesktopBuilds: DesktopBuild[] = $state([]);
  let currentVersion = $state("");
  let isChecking = $state(false);
  let isDownloading = $state(false);
  let downloadProgress = $state("");
  let updateCoordinatorState: UpdateCoordinatorState = $state(null);

  async function checkForLatestRelease() {
    if (!isElectron) return;

    isChecking = true;
    try {
      const updateInfo = await (window as any).electronFileSystem.checkUpdatesWithStrategy();
      if (updateInfo) {
        latestRelease = {
          version: updateInfo.version,
          downloadUrl: updateInfo.downloadUrl,
          publishedAt: updateInfo.publishedAt,
          size: updateInfo.size,
        };
        updateCoordinatorState = updateInfo.strategy;
      } else {
        latestRelease = null;
        updateCoordinatorState = null;
      }

      currentVersion = await (window as any).electronFileSystem.getCurrentBuildVersion();
      availableBuilds = await (window as any).electronFileSystem.getAvailableBuilds();
      allAvailableDesktopBuilds = await (window as any).electronFileSystem.getAllAvailableDesktopBuilds();

      if ((window as any).electronFileSystem.getUpdateCoordinatorState) {
        const coordinatorState = await (window as any).electronFileSystem.getUpdateCoordinatorState();
        updateCoordinatorState = {
          ...updateCoordinatorState,
          ...coordinatorState,
        };
      }
    } catch (error) {
      console.error("Error checking for latest release:", error);
    } finally {
      isChecking = false;
    }
  }

  async function downloadLatestBuild() {
    if (!isElectron || !latestRelease) return;

    isDownloading = true;
    downloadProgress = "Downloading...";
    try {
      const success = await (window as any).electronFileSystem.downloadGitHubBuild(
        latestRelease.downloadUrl,
        latestRelease.version,
      );

      if (success) {
        downloadProgress = "Download complete! Reloading...";
        window.location.href = "sila://builds/desktop/index.html";
      } else {
        downloadProgress = "Download failed";
      }
    } catch (error) {
      console.error("Error downloading build:", error);
      downloadProgress = "Download failed: " + (error as Error).message;
    } finally {
      isDownloading = false;
    }
  }

  async function downloadSpecificBuild(build: DesktopBuild) {
    if (!isElectron) return;

    isDownloading = true;
    downloadProgress = `Downloading ${build.version}...`;
    try {
      const success = await (window as any).electronFileSystem.downloadGitHubBuild(
        build.downloadUrl,
        build.version,
      );

      if (success) {
        downloadProgress = "Download complete! Reloading...";
        window.location.href = "sila://builds/desktop/index.html";
      } else {
        downloadProgress = "Download failed";
      }
    } catch (error) {
      console.error("Error downloading build:", error);
      downloadProgress = "Download failed: " + (error as Error).message;
    } finally {
      isDownloading = false;
    }
  }

  onMount(() => {
    if (isElectron) {
      checkForLatestRelease();
    }
  });
</script>

<div class="flex flex-col gap-4 p-2">
  {#if isElectron}
    <div class="border-t border-surface-200-700-token pt-4">
      <h3 class="text-sm font-medium text-surface-900-100-token mb-3">
        GitHub Release Manager
      </h3>

      <div class="space-y-3">
        <div class="text-xs text-surface-600-300-token">
          Current Version: {currentVersion}
        </div>

        {#if updateCoordinatorState && updateCoordinatorState.reason}
          <div class="bg-blue-50-800-token p-3 rounded border">
            <div class="text-sm font-medium text-blue-900-100-token mb-1">
              Update Strategy
            </div>
            <div class="text-xs text-blue-700-300-token mb-2">
              {updateCoordinatorState.reason}
            </div>
            <div class="text-xs text-blue-600-400-token">
              Priority: {updateCoordinatorState.priority} |
              Use Full App: {updateCoordinatorState.useFullAppUpdate ? "Yes" : "No"} |
              Use Client Bundle: {updateCoordinatorState.useClientBundleUpdate ? "Yes" : "No"}
            </div>
          </div>
        {/if}

        {#if updateCoordinatorState}
          <div class="text-xs text-surface-600-300-token">
            Update State:
            {updateCoordinatorState.fullAppUpdate ? "Full App Update" : "No Full App Update"} |
            {updateCoordinatorState.clientBundleUpdate ? "Client Bundle Update" : "No Client Bundle Update"} |
            {updateCoordinatorState.dialogShown ? "Dialog Shown" : "No Dialog"}
          </div>
        {/if}

        {#if availableBuilds.length > 0}
          <div class="text-xs text-surface-600-300-token">
            Available Builds: {availableBuilds.join(", ")}
          </div>
        {/if}

        {#if allAvailableDesktopBuilds.length > 0}
          <div class="bg-surface-50-800-token p-3 rounded border">
            <div class="text-sm font-medium text-surface-900-100-token mb-2">
              All Available Desktop Builds ({allAvailableDesktopBuilds.length})
            </div>
            <div class="space-y-2 max-h-40 overflow-y-auto">
              {#each allAvailableDesktopBuilds as build}
                <div class="flex items-center justify-between bg-surface-100-700-token p-2 rounded text-xs">
                  <div>
                    <div class="font-medium text-surface-900-100-token">v{build.version}</div>
                    <div class="text-surface-600-300-token">
                      {new Date(build.publishedAt).toLocaleDateString()} ({build.releaseTag})
                      {#if build.size}
                        - {(build.size / 1024 / 1024).toFixed(1)} MB
                      {/if}
                    </div>
                  </div>
                  <button
                    class="btn btn-xs variant-outline"
                    onclick={() => downloadSpecificBuild(build)}
                    disabled={isDownloading}
                  >
                    Download
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if latestRelease}
          <div class="bg-surface-50-800-token p-3 rounded border">
            <div class="text-sm font-medium text-surface-900-100-token mb-2">
              Latest Release: v{latestRelease.version}
            </div>
            <div class="text-xs text-surface-600-300-token mb-2">
              Published: {new Date(latestRelease.publishedAt).toLocaleDateString()}
            </div>
            {#if typeof latestRelease.size === "number"}
              <div class="text-xs text-surface-600-300-token mb-3">
                Size: {(latestRelease.size / 1024 / 1024).toFixed(1)} MB
              </div>
            {/if}

            {#if latestRelease.version !== currentVersion}
              <button
                class="btn btn-sm variant-filled"
                onclick={downloadLatestBuild}
                disabled={isDownloading}
              >
                {isDownloading ? "Downloading..." : "Download & Install Latest"}
              </button>
            {:else}
              <div class="text-xs text-green-600-400-token">✓ You're on the latest version</div>
            {/if}
          </div>
        {/if}

        {#if downloadProgress}
          <div class="text-xs text-surface-600-300-token">
            {downloadProgress}
          </div>
        {/if}

        <button
          class="btn btn-sm variant-soft"
          onclick={checkForLatestRelease}
          disabled={isChecking}
        >
          {isChecking ? "Checking..." : "Check for Updates"}
        </button>
      </div>
    </div>
  {:else}
    <div class="border-t border-surface-200-700-token pt-4 text-xs text-surface-600-300-token">
      Desktop updates are only available in the Electron build.
    </div>
  {/if}
</div>

