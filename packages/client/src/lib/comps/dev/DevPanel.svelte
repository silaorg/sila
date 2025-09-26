<script lang="ts">
  import { isDevMode } from "@sila/client/state/devMode";
  import { spaceInspectorOpen } from "@sila/client/state/devMode";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  // GitHub release state
  let latestRelease = null;
  let availableBuilds = [];
  let currentVersion = '';
  let isChecking = false;
  let isDownloading = false;
  let downloadProgress = '';
  let updateCoordinatorState = null;

  // Check if we're in Electron
  const isElectron = typeof window !== 'undefined' && window.electronFileSystem;

  async function checkForLatestRelease() {
    if (!isElectron) return;
    
    isChecking = true;
    try {
      latestRelease = await window.electronFileSystem.checkGitHubRelease();
      currentVersion = await window.electronFileSystem.getCurrentBuildVersion();
      availableBuilds = await window.electronFileSystem.getAvailableBuilds();
      
      // Check update coordinator state if available
      if (window.electronFileSystem.getUpdateCoordinatorState) {
        updateCoordinatorState = await window.electronFileSystem.getUpdateCoordinatorState();
      }
    } catch (error) {
      console.error('Error checking for latest release:', error);
    } finally {
      isChecking = false;
    }
  }

  async function downloadLatestBuild() {
    if (!isElectron || !latestRelease) return;
    
    isDownloading = true;
    downloadProgress = 'Downloading...';
    try {
      const success = await window.electronFileSystem.downloadGitHubBuild(
        latestRelease.downloadUrl, 
        latestRelease.version
      );
      
      if (success) {
        downloadProgress = 'Download complete! Reloading...';
        // Reload to the latest build
        window.location.href = 'sila://builds/desktop/index.html';
      } else {
        downloadProgress = 'Download failed';
      }
    } catch (error) {
      console.error('Error downloading build:', error);
      downloadProgress = 'Download failed: ' + error.message;
    } finally {
      isDownloading = false;
    }
  }

  // Load initial data
  if (isElectron) {
    checkForLatestRelease();
  }
</script>

<div class="flex flex-col gap-4 p-2">
  <div class="flex gap-4 items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="text-sm text-surface-600-300-token">🚧 Sila v1.0.0 in Dev Mode</div>
      <button class="btn btn-sm variant-soft" onclick={() => $isDevMode = false}>Exit Dev Mode</button>
    </div>
    <button class="btn btn-sm variant-soft" onclick={() => $spaceInspectorOpen ? ($spaceInspectorOpen = false) : ($spaceInspectorOpen = true)}>
      {$spaceInspectorOpen ? 'Close Space Inspector' : 'Open Space Inspector'}
    </button>
  </div>

  <!-- GitHub Release Section -->
  {#if isElectron}
    <div class="border-t border-surface-200-700-token pt-4">
      <h3 class="text-sm font-medium text-surface-900-100-token mb-3">GitHub Release Manager</h3>
      
      <div class="space-y-3">
        <!-- Current Version -->
        <div class="text-xs text-surface-600-300-token">
          Current Version: {currentVersion}
        </div>

        <!-- Update Coordinator State -->
        {#if updateCoordinatorState}
          <div class="text-xs text-surface-600-300-token">
            Update State: 
            {updateCoordinatorState.fullAppUpdate ? 'Full App Update' : 'No Full App Update'} | 
            {updateCoordinatorState.clientBundleUpdate ? 'Client Bundle Update' : 'No Client Bundle Update'} |
            {updateCoordinatorState.dialogShown ? 'Dialog Shown' : 'No Dialog'}
          </div>
        {/if}

        <!-- Available Builds -->
        {#if availableBuilds.length > 0}
          <div class="text-xs text-surface-600-300-token">
            Available Builds: {availableBuilds.join(', ')}
          </div>
        {/if}

        <!-- Latest Release Info -->
        {#if latestRelease}
          <div class="bg-surface-50-800-token p-3 rounded border">
            <div class="text-sm font-medium text-surface-900-100-token mb-2">
              Latest Release: v{latestRelease.version}
            </div>
            <div class="text-xs text-surface-600-300-token mb-2">
              Published: {new Date(latestRelease.publishedAt).toLocaleDateString()}
            </div>
            <div class="text-xs text-surface-600-300-token mb-3">
              Size: {(latestRelease.size / 1024 / 1024).toFixed(1)} MB
            </div>
            
            {#if latestRelease.version !== currentVersion}
              <button 
                class="btn btn-sm variant-filled" 
                onclick={downloadLatestBuild}
                disabled={isDownloading}
              >
                {isDownloading ? 'Downloading...' : 'Download & Install Latest'}
              </button>
            {:else}
              <div class="text-xs text-green-600-400-token">✓ You're on the latest version</div>
            {/if}
          </div>
        {/if}

        <!-- Download Progress -->
        {#if downloadProgress}
          <div class="text-xs text-surface-600-300-token">
            {downloadProgress}
          </div>
        {/if}

        <!-- Check for Updates Button -->
        <button 
          class="btn btn-sm variant-soft" 
          onclick={checkForLatestRelease}
          disabled={isChecking}
        >
          {isChecking ? 'Checking...' : 'Check for Updates'}
        </button>
      </div>
    </div>
  {/if}
</div>
