<script lang="ts">
  import { txtStore } from "@sila/client/state/txtStore";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();

  type Status = "idle" | "selectingLocation" | "naming" | "creating" | "opening";
  let status: Status = $state("idle");

  let {
    onSpaceSetup,
  }: { onSpaceSetup?: (spaceId: string) => void } = $props();

  const presetNames = ["Personal", "Work", "Studies", "School"];

  let workspaceName = $state("");
  let workspaceNameError = $state("");
  let selectedParentPath = $state<string | null>(null);

  function resetCreateFlow() {
    status = "idle";
    workspaceName = "";
    workspaceNameError = "";
    selectedParentPath = null;
  }

  function sanitizeFolderName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      return "";
    }

    return trimmed
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function folderNameCandidate(name: string): string {
    return sanitizeFolderName(name) || "New Workspace";
  }

  function normalizePathSelection(path: string | string[] | null | undefined): string | null {
    if (!path) {
      return null;
    }

    if (Array.isArray(path)) {
      return path[0] ?? null;
    }

    return path;
  }

  let workspaceFolderPreview = $derived.by(() => {
    if (!selectedParentPath) {
      return null;
    }

    return `${selectedParentPath}/${folderNameCandidate(workspaceName)}`;
  });

  async function promptForLocation(): Promise<string | null> {
  const selection = await clientState.dialog.openDialog({
    title: "Choose where to create your workspace",
    directory: true,
    defaultPath: selectedParentPath ?? undefined,
  });

  return normalizePathSelection(selection ?? null);
  }

  async function browseForLocation() {
    try {
      const path = await promptForLocation();
      if (!path) {
        if (!selectedParentPath) {
          resetCreateFlow();
        }
        return;
      }

      selectedParentPath = path;
    } catch (e) {
      console.error(e);
      await clientState.dialog.showError({
        title: "Failed to Access Folder",
        message: "We couldn't access the selected folder.",
        detail: e instanceof Error ? e.message : "An unknown error occurred while choosing the folder.",
        buttons: ["OK"],
      });
    }
  }

  async function startCreateFlow() {
    if (status !== "idle") return;

    status = "selectingLocation";
    workspaceNameError = "";

    try {
      const path = await promptForLocation();
      if (!path) {
        status = "idle";
        return;
      }

      selectedParentPath = path;
      if (!workspaceName.trim()) {
        workspaceName = presetNames[0];
      }

      status = "naming";
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

  async function cancelNaming() {
    resetCreateFlow();
  }

  async function confirmCreateWorkspace() {
    if (status !== "naming" && status !== "creating") return;
    if (!selectedParentPath) return;

    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      workspaceNameError = "Workspace name cannot be empty.";
      return;
    }

    const folderName = sanitizeFolderName(trimmedName);
    if (!folderName) {
      workspaceNameError = "Workspace name contains unsupported characters.";
      return;
    }

    const targetPath = `${selectedParentPath}/${folderName}`;

    status = "creating";
    workspaceNameError = "";

    try {
      const spaceId = await clientState.createSpace(targetPath);
      await clientState.updateSpaceName(spaceId, trimmedName);
      resetCreateFlow();
      onSpaceSetup?.(spaceId);
    } catch (e) {
      console.error(e);
      workspaceNameError = e instanceof Error ? e.message : "Failed to create the workspace.";
      await clientState.dialog.showError({
        title: "Failed to Create Workspace",
        message: $txtStore.spacesPage.opener.errorCreate,
        detail: workspaceNameError,
        buttons: ["OK"],
      });
      status = "naming";
    }
  }

  function handleWorkspaceSubmit(event: SubmitEvent) {
    event.preventDefault();
    confirmCreateWorkspace();
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

  {#if status === "naming" || status === "creating"}
    <div class="mt-6 rounded-xl border border-surface-200/70 bg-surface-50/80 p-6 shadow-sm dark:border-surface-800/60 dark:bg-surface-900/70">
      <h4 class="text-base font-semibold">Create new workspace</h4>
      <p class="text-sm text-surface-500 mt-1">
        Workspace folder will be created in
        <span class="font-mono text-primary-500">{selectedParentPath ?? "Select a location"}</span>
      </p>

      <form class="mt-4 space-y-4" onsubmit={handleWorkspaceSubmit}>
        <div class="form-control">
          <label class="label" for="workspaceName">
            <span class="label-text">Workspace name</span>
          </label>
          <input
            id="workspaceName"
            type="text"
            class="input {workspaceNameError ? 'input-error' : ''}"
            bind:value={workspaceName}
            placeholder="My Workspace"
            autocomplete="off"
            disabled={status === "creating"}
          />
          {#if workspaceNameError}
            <p class="text-error-500 text-sm mt-2">{workspaceNameError}</p>
          {/if}
        </div>

        <div>
          <p class="text-sm mb-2">Suggestions</p>
          <div class="flex flex-wrap gap-2">
            {#each presetNames as name}
              <button
                type="button"
                class="btn btn-sm preset-outlined"
                class:preset-filled={name.toLowerCase() === workspaceName.toLowerCase()}
                onclick={() => (workspaceName = name)}
                disabled={status === "creating"}
              >
                {name}
              </button>
            {/each}
          </div>
        </div>

        <div class="rounded-md bg-surface-100/70 p-3 text-sm dark:bg-surface-800/70">
          <strong class="block text-xs uppercase tracking-wide text-surface-500">Folder preview</strong>
          <span class="font-mono text-sm break-words">
            {workspaceFolderPreview ?? "Select a location"}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            class="btn preset-filled-primary-500"
            disabled={status === "creating"}
          >
            {status === "creating" ? "Creating..." : "Create workspace"}
          </button>
          <button
            type="button"
            class="btn preset-outlined"
            onclick={browseForLocation}
            disabled={status === "creating"}
          >
            Change location
          </button>
          <button
            type="button"
            class="btn preset-ghost"
            onclick={cancelNaming}
            disabled={status === "creating"}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

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
