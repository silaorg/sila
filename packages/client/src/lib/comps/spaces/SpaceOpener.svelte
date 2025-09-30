<script lang="ts">
  import { txtStore } from "@sila/client/state/txtStore";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();

  type Status = "idle" | "selectingLocation" | "opening";
  let status: Status = $state("idle");

  let {
    onSpaceSetup,
  }: { onSpaceSetup?: (spaceId: string) => void } = $props();

  let selectedParentPath = $state<string | null>(null);

  function normalizePathSelection(path: string | string[] | null | undefined): string | null {
    if (!path) {
      return null;
    }

    if (Array.isArray(path)) {
      return path[0] ?? null;
    }

    return path;
  }

  async function promptForLocation(): Promise<string | null> {
  const selection = await clientState.dialog.openDialog({
    title: "Choose where to create your workspace",
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

      selectedParentPath = path;
      openWorkspaceNaming(path);
      status = "idle";
    } catch (e) {
      console.error(e);
      await clientState.dialog.showError({
        title: "Failed to Open Folder",
        message: $txtStore.spacesPage.opener.errorCreate,
        detail: e instanceof Error ? e.message : "An unknown error occurred while choosing the folder.",
        buttons: ["OK"],
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
      "create-workspace",
      {
        parentPath,
        onComplete: handleWorkspaceCreated,
        onParentPathChange: handleParentPathChange,
        onCancel: handleParentPathChange,
      },
      "Create workspace"
    );
  }

  async function openSpaceDialog() {
    if (status !== "idle") return;

    status = "opening";
    try {
      const selection = await clientState.dialog.openDialog({
        title: $txtStore.spacesPage.opener.dialogOpenTitle,
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
        title: "Failed to Open Space",
        message: $txtStore.spacesPage.opener.errorOpen,
        detail: e instanceof Error ? e.message : "An unknown error occurred while opening the space.",
        buttons: ["OK"],
      });
    } finally {
      status = "idle";
    }
  }
</script>

<div>
  <div class="flex items-center justify-between mt-4">
    <div>
      <h3 class="text-lg font-semibold">
        {$txtStore.spacesPage.opener.createTitle}
      </h3>
      <p class="text-sm">
        {$txtStore.spacesPage.opener.createDescription}
      </p>
    </div>
    <button
      class="btn preset-filled-primary-500"
      onclick={startCreateFlow}
      disabled={status !== "idle"}
    >
      {status === "creating"
        ? "Creating..."
        : $txtStore.spacesPage.opener.createButton}
    </button>
  </div>

  <div class="flex items-center justify-between mt-4">
    <div>
      <h3 class="text-lg font-semibold">
        {$txtStore.spacesPage.opener.openTitle}
      </h3>
      <p class="text-sm">{$txtStore.spacesPage.opener.openDescription}</p>
    </div>
    <button
      class="btn preset-outlined-primary-500"
      onclick={openSpaceDialog}
      disabled={status !== "idle"}
    >
      {status === "opening"
        ? "Opening..."
        : $txtStore.spacesPage.opener.openButton}
    </button>
  </div>
</div>
