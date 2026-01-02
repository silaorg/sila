<script lang="ts">
  import { onMount } from "svelte";
  import { i18n } from "@sila/client";

  const isElectron =
    typeof window !== "undefined" && Boolean((window as any).electronFileSystem);

  let isCheckingUpdates = $state(false);
  let updateStage: string = $state("idle"); // idle | checking | downloading | ready | error
  let updateKind: "electron" | "desktop-build" | null = $state(null);
  let updatePercent: number | null = $state(null);
  let updateVersion: string | null = $state(null);
  let updateMessage: string | null = $state(null);

  const isBusy = $derived(updateStage === "checking" || updateStage === "downloading");

  const updateLabel = $derived.by(() => {
    if (updateStage === "checking") return i18n.texts.updates.checkingLabel;
    if (updateStage === "downloading") {
      const what =
        updateKind === "desktop-build"
          ? i18n.texts.updates.downloadKindClientBuild
          : updateKind === "electron"
            ? i18n.texts.updates.downloadKindElectron
            : i18n.texts.updates.downloadKindUpdate;
      return i18n.texts.updates.downloadingLabel(what, updateVersion);
    }
    if (updateStage === "ready") return i18n.texts.updates.downloadedLabel;
    if (updateStage === "error") return updateMessage || i18n.texts.updates.failedLabel;
    return "";
  });

  async function checkForUpdates() {
    if (!isElectron) return;
    if (isCheckingUpdates) return;

    isCheckingUpdates = true;
    updateStage = "checking";
    updateKind = null;
    updatePercent = null;
    updateMessage = null;
    try {
      await (window as any).electronFileSystem.checkForUpdates();
    } catch (e) {
      updateStage = "error";
      updateMessage = String(e);
    } finally {
      isCheckingUpdates = false;
      if (updateStage === "checking") updateStage = "idle";
    }
  }

  onMount(() => {
    if (!isElectron) return;

    const unsubProgress = (window as any).desktopUpdater?.onUpdateProgress?.((payload: any) => {
      if (payload?.kind) updateKind = payload.kind;
      if (payload?.version) updateVersion = payload.version;
      if (typeof payload?.percent === "number") updatePercent = payload.percent;
      else if (payload?.percent === null) updatePercent = null;

      if (payload?.stage) updateStage = String(payload.stage);
      if (payload?.message) updateMessage = String(payload.message);
    });

    return () => {
      if (typeof unsubProgress === "function") unsubProgress();
    };
  });
</script>

{#if isElectron}
  <section class="space-y-2">
    <div class="text-sm font-medium">{i18n.texts.updates.updatesTitle}</div>

    {#if !isBusy}
      <button class="btn btn-sm preset-filled" onclick={checkForUpdates} disabled={isCheckingUpdates}>
        {isCheckingUpdates
          ? i18n.texts.updates.checkingForUpdates
          : i18n.texts.updates.checkForUpdates}
      </button>
    {/if}

    {#if isBusy}
      <div class="space-y-2">
        <div class="text-xs text-surface-600-300-token">{updateLabel}</div>

        {#if updatePercent === null}
          <progress class="progress" max="100"></progress>
        {:else}
          <progress class="progress" max="100" value={updatePercent}></progress>
        {/if}

        {#if updatePercent !== null}
          <div class="text-xs text-surface-600-300-token">{updatePercent}%</div>
        {/if}
      </div>
    {/if}
  </section>
{/if}
