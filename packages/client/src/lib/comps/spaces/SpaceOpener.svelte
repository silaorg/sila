<script lang="ts">
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
import { swinsLayout } from "@sila/client/state/swinsLayout";
import {
  ensurePathIsNotInsideExistingSpace,
  normalizePathSelection,
} from "@sila/client/spaces/fileSystemSpaceUtils";

  const clientState = useClientState();

  type Status = "idle" | "selectingLocation" | "opening";
  let status: Status = $state("idle");

  let { onSpaceSetup }: { onSpaceSetup?: (spaceId: string) => void } = $props();

  let selectedParentPath = $state<string | null>(null);

  async function promptForLocation(): Promise<string | null> {
    const selection = await clientState.dialog.openDialog({
      title: i18n.texts.workspaceCreate.chooseLocationTitle,
      directory: true,
      defaultPath: selectedParentPath ?? undefined,
    });

    return normalizePathSelection(selection ?? null);
  }

  async function startCreateFlow() {
    if (status !== "idle") return;

    status = "selectingLocation";

    try {
      const path = await promptForLocation();
      if (!path) {
        status = "idle";
        return;
      }

      try {
        await ensurePathIsNotInsideExistingSpace(clientState, path);
      } catch (validationError) {
        await clientState.dialog.showError({
          title: i18n.texts.workspaceCreate.folderAlreadyUsedTitle,
          message: i18n.texts.workspaceCreate.folderAlreadyUsedMessage,
          detail:
            validationError instanceof Error
              ? validationError.message
              : String(validationError),
          buttons: [i18n.texts.actions.ok],
        });
        status = "idle";
        return;
      }

      selectedParentPath = path;
      openWorkspaceNaming(path);
      status = "idle";
    } catch (e) {
      console.error(e);
      await clientState.dialog.showError({
        title: i18n.texts.workspaceCreate.failedAccessFolderTitle,
        message: i18n.texts.spacesPage.opener.errorCreate,
        detail:
          e instanceof Error
            ? e.message
            : i18n.texts.workspaceCreate.failedAccessFolderUnknown,
        buttons: [i18n.texts.actions.ok],
      });
      status = "idle";
    }
  }

  function handleParentPathChange(path?: string) {
    if (path) {
      selectedParentPath = path;
    }
  }

  function handleWorkspaceCreated(spaceId: string, folderPath: string) {
    selectedParentPath = folderPath;
    onSpaceSetup?.(spaceId);
  }

  function openWorkspaceNaming(parentPath: string) {
    clientState.layout.swins.open(
      swinsLayout.createWorkspace.key,
      {
        parentPath,
        onComplete: handleWorkspaceCreated,
        onParentPathChange: handleParentPathChange,
        onCancel: handleParentPathChange,
      },
      i18n.texts.workspaceCreate.createWorkspace
    );
  }

  async function openSpaceDialog() {
    if (status !== "idle") return;

    status = "opening";
    try {
      const selection = await clientState.dialog.openDialog({
        title: i18n.texts.spacesPage.opener.dialogOpenTitle,
        directory: true,
      });

      const path = normalizePathSelection(selection ?? null);
      if (!path) {
        status = "idle";
        return;
      }

      const spaceId = await clientState.loadSpace(path);
      onSpaceSetup?.(spaceId);
    } catch (e) {
      console.error(e);

      await clientState.dialog.showError({
        title: i18n.texts.spacesPage.opener.errorOpenTitle,
        message: i18n.texts.spacesPage.opener.errorOpen,
        detail:
          e instanceof Error
            ? e.message
            : i18n.texts.spacesPage.opener.errorOpenUnknown,
        buttons: [i18n.texts.actions.ok],
      });
    } finally {
      status = "idle";
    }
  }
</script>

<div>
  <div class="flex items-center justify-between mt-4 gap-4">
    <div>
      <h3 class="text-lg font-semibold">
        {i18n.texts.spacesPage.opener.createTitle}
      </h3>
      <p class="text-sm">
        {i18n.texts.spacesPage.opener.createDescription}
      </p>
    </div>
    <button
      class="btn preset-filled-primary-500"
      onclick={startCreateFlow}
      disabled={status !== "idle"}
    >
      {i18n.texts.spacesPage.opener.createButton}
    </button>
  </div>

  <div class="flex items-center justify-between mt-4 gap-4">
    <div>
      <h3 class="text-lg font-semibold">
        {i18n.texts.spacesPage.opener.openTitle}
      </h3>
      <p class="text-sm">{i18n.texts.spacesPage.opener.openDescription}</p>
    </div>
    <button
      class="btn preset-outlined-primary-500"
      onclick={openSpaceDialog}
      disabled={status !== "idle"}
    >
      {i18n.texts.spacesPage.opener.openButton}
    </button>
  </div>
</div>
