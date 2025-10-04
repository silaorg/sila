<script lang="ts">
  import { onMount } from "svelte";

  type DesktopBuild = {
    version: string;
    downloadUrl: string;
    publishedAt: string;
    releaseTag?: string;
    size?: number;
  };

  // Coordinator removed
  type UpdateCoordinatorState = null;

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
      const updateInfo = await (window as any).electronFileSystem.checkGitHubRelease();
      if (updateInfo) {
        latestRelease = {
          version: updateInfo.version,
          downloadUrl: updateInfo.downloadUrl,
          publishedAt: updateInfo.publishedAt,
          size: updateInfo.size,
        };
        updateCoordinatorState = null;
      } else {
        latestRelease = null;
        updateCoordinatorState = null;
      }

      currentVersion = await (window as any).electronFileSystem.getCurrentBuildVersion();
      availableBuilds = await (window as any).electronFileSystem.getAvailableBuilds();
      allAvailableDesktopBuilds = await (window as any).electronFileSystem.getAllAvailableDesktopBuilds();

      // coordinator removed
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
        window.location.href = "sila://client/index.html";
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
        window.location.href = "sila://client/index.html";
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

<div class="flex h-full flex-col gap-6 p-4" data-component="desktop-updates">
  {#if isElectron}
    <section class="space-y-4">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-1">
          <h2 class="text-base font-medium text-surface-900-100-token">Desktop Updates</h2>
          <p class="text-xs text-surface-600-300-token">
            Current version:
            <span class="font-mono text-surface-900-100-token">{currentVersion || "—"}</span>
          </p>
          {#if availableBuilds.length > 0}
            <p class="text-xs text-surface-500-400-token">
              Cached builds: {availableBuilds.join(", ")}
            </p>
          {/if}
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

      {#if downloadProgress}
        <div class="text-xs text-surface-600-300-token">
          {downloadProgress}
        </div>
      {/if}

      

      {#if latestRelease}
        <div class="space-y-3 rounded border border-surface-200-700-token bg-surface-50-800-token p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="text-sm font-medium text-surface-900-100-token">Latest release</div>
              <div class="text-xs text-surface-600-300-token">v{latestRelease.version}</div>
            </div>
            {#if latestRelease.version !== currentVersion}
              <button
                class="btn btn-sm variant-filled"
                onclick={downloadLatestBuild}
                disabled={isDownloading}
              >
                {isDownloading ? "Downloading..." : "Install latest"}
              </button>
            {/if}
          </div>

          <div class="text-xs text-surface-600-300-token">
            Published: {new Date(latestRelease.publishedAt).toLocaleDateString()}
          </div>

          {#if typeof latestRelease.size === "number"}
            <div class="text-xs text-surface-600-300-token">
              Size: {(latestRelease.size / 1024 / 1024).toFixed(1)} MB
            </div>
          {/if}

          {#if latestRelease.version === currentVersion}
            <div class="text-xs text-green-600-400-token">✓ You're on the latest version</div>
          {/if}
        </div>
      {/if}

      {#if allAvailableDesktopBuilds.length > 0}
        <div class="rounded border border-surface-200-700-token bg-surface-50-800-token">
          <div class="flex items-center justify-between border-b border-surface-200-700-token px-3 py-2">
            <div class="text-sm font-medium text-surface-900-100-token">
              All available desktop builds
            </div>
            <div class="text-xs text-surface-600-300-token">
              {allAvailableDesktopBuilds.length}
            </div>
          </div>
          <div class="max-h-60 overflow-y-auto divide-y divide-surface-200-700-token">
            {#each allAvailableDesktopBuilds as build}
              <div class="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div class="space-y-1">
                  <div class="font-medium text-surface-900-100-token">v{build.version}</div>
                  <div class="text-surface-600-300-token">
                    {new Date(build.publishedAt).toLocaleDateString()} ({build.releaseTag})
                    {#if build.size}
                      · {(build.size / 1024 / 1024).toFixed(1)} MB
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
    </section>
  {:else}
    <div class="rounded border border-surface-200-700-token bg-surface-50-800-token p-3 text-xs text-surface-600-300-token">
      Desktop updates are only available in the desktop app.
    </div>
  {/if}
</div>

