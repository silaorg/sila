<script lang="ts">
  import { isDevMode } from "@sila/client/state/devMode";
  import { spaceInspectorOpen } from "@sila/client/state/devMode";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  const isElectron = typeof window !== "undefined" && (window as any).electronFileSystem;

  function openDesktopUpdates() {
    if (!isElectron) return;

    clientState.layout.swins.open(
      swinsLayout.desktopUpdates.key,
      {},
      i18n.texts.devPanel.desktopUpdatesTitle
    );
  }
</script>

<div class="flex flex-col gap-4 p-2">
  <div class="flex gap-4 items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="text-sm text-surface-600-300-token">
        {i18n.texts.devPanel.devModeStatus(clientState.appVersion || "…")}
      </div>
      <button class="btn btn-sm variant-soft" onclick={() => $isDevMode = false}>
        {i18n.texts.devPanel.exitDevMode}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn btn-sm variant-soft" onclick={() => $spaceInspectorOpen ? ($spaceInspectorOpen = false) : ($spaceInspectorOpen = true)}>
        {$spaceInspectorOpen
          ? i18n.texts.devPanel.closeSpaceInspector
          : i18n.texts.devPanel.openSpaceInspector}
      </button>
      {#if isElectron}
        <button
          class="btn btn-sm variant-filled"
          onclick={openDesktopUpdates}
        >
          {i18n.texts.devPanel.desktopUpdatesTitle}
        </button>
      {/if}
    </div>
  </div>
</div>
