<script lang="ts">
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
import {
  checkIfCanCreateSpaceAndReturnPath,
  ensurePathIsNotInsideExistingSpace,
} from "@sila/client/spaces/fileSystemSpaceUtils";

  const clientState = useClientState();

  type Status = "idle" | "creating";

  let {
    parentPath,
    onComplete,
    onParentPathChange,
    onCancel,
  }: {
    parentPath: string;
    onComplete?: (spaceId: string, folderPath: string) => void;
    onParentPathChange?: (folderPath: string) => void;
    onCancel?: (folderPath?: string) => void;
  } = $props();

  const defaultPresetNames = ["Personal", "Work", "Studies", "School"];

  let presets = $state<string[]>([...defaultPresetNames]);
  let workspaceName = $state(defaultPresetNames[0]);
  let workspaceNameError = $state("");
  let status: Status = $state("idle");
  let currentParentPath = $state(parentPath);

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
    const sanitized = sanitizeFolderName(name);
    return sanitized ? sanitized.toLowerCase() : "new workspace";
  }

  function normalizePathSelection(
    path: string | string[] | null | undefined
  ): string | null {
    if (!path) {
      return null;
    }

    if (Array.isArray(path)) {
      return path[0] ?? null;
    }

    return path;
  }

  let existingFolderNames = $state<Set<string>>(new Set());

  let workspaceFolderPreview = $derived.by(() => {
    if (!currentParentPath) {
      return null;
    }

    const sanitized = sanitizeFolderName(workspaceName);
    if (!sanitized) {
      return currentParentPath;
    }

    return `${currentParentPath}/${sanitized}`;
  });

  async function refreshExistingFolders(path: string | null) {
    try {
      if (!path) {
        existingFolderNames = new Set();
        presets = [...defaultPresetNames];
        return;
      }

      const entries = await clientState.fs.readDir(path);
      const directoryNames = entries
        .filter((entry) => entry.isDirectory && !entry.name.startsWith("."))
        .map((entry) => folderNameCandidate(entry.name));

      existingFolderNames = new Set(directoryNames);

      const filteredPresets = defaultPresetNames.filter(
        (name) => !existingFolderNames.has(folderNameCandidate(name))
      );

      presets =
        filteredPresets.length > 0
          ? filteredPresets
          : [...defaultPresetNames];

      if (
        (!workspaceName.trim() && presets.length > 0) ||
        (defaultPresetNames.includes(workspaceName) &&
          !presets.some(
            (preset) =>
              folderNameCandidate(preset) === folderNameCandidate(workspaceName)
          ))
      ) {
        workspaceName = presets[0];
      }
    } catch (e) {
      console.error("Failed to read directory", e);
      existingFolderNames = new Set();
      presets = [...defaultPresetNames];
    }
  }

  async function chooseLocation() {
    try {
      const selection = await clientState.dialog.openDialog({
        title: "Choose where to create your workspace",
        directory: true,
        defaultPath: currentParentPath ?? undefined,
      });

      const path = normalizePathSelection(selection ?? null);
      if (!path) {
        return;
      }

      try {
        await ensurePathIsNotInsideExistingSpace(clientState, path);
      } catch (validationError) {
        await clientState.dialog.showError({
          title: "Folder Already Used",
          message: "Pick a folder outside of existing workspaces.",
          detail:
            validationError instanceof Error
              ? validationError.message
              : String(validationError),
          buttons: ["OK"],
        });
        return;
      }

      currentParentPath = path;
      await refreshExistingFolders(path);
      onParentPathChange?.(path);
    } catch (e) {
      console.error(e);
      await clientState.dialog.showError({
        title: "Failed to Access Folder",
        message: "We couldn't access the selected folder.",
        detail:
          e instanceof Error
            ? e.message
            : "An unknown error occurred while choosing the folder.",
        buttons: ["OK"],
      });
    }
  }

  onMount(() => {
    refreshExistingFolders(currentParentPath);
  });

  let lastParentPath = $state(parentPath);

  $effect(() => {
    if (parentPath === lastParentPath) {
      return;
    }

    lastParentPath = parentPath;
    currentParentPath = parentPath ?? null;
    refreshExistingFolders(parentPath ?? null);
  });

  function closeWindow() {
    onCancel?.(currentParentPath ?? undefined);
    clientState.layout.swins.pop();
  }

  function suggestNameOnFocus() {
    if (!workspaceName.trim() && presets.length > 0) {
      workspaceName = presets[0];
    }
  }

  function isNameTaken(name: string): boolean {
    return existingFolderNames.has(folderNameCandidate(name));
  }

  let nameAlreadyExists = $derived.by(() => {
    const trimmed = workspaceName.trim();
    if (!trimmed) return false;
    return isNameTaken(trimmed);
  });

  async function confirmCreateWorkspace() {
    if (status === "creating") return;

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

    if (isNameTaken(trimmedName)) {
      workspaceNameError =
        "A folder with this name already exists in the selected location.";
      return;
    }

    if (!currentParentPath) {
      workspaceNameError = "Choose a folder to store the workspace.";
      return;
    }

    const targetPath = `${currentParentPath}/${folderName}`;

    try {
      await checkIfCanCreateSpaceAndReturnPath(clientState, targetPath);
    } catch (validationError) {
      workspaceNameError =
        validationError instanceof Error
          ? validationError.message
          : String(validationError);
      await clientState.dialog.showError({
        title: "Cannot Use This Folder",
        message: "Choose a different location for your workspace.",
        detail: workspaceNameError,
        buttons: ["OK"],
      });
      return;
    }

    status = "creating";
    workspaceNameError = "";

    try {
      const spaceId = await clientState.createSpace(targetPath);
      await clientState.updateSpaceName(spaceId, trimmedName);

      onParentPathChange?.(currentParentPath);
      onComplete?.(spaceId, currentParentPath);

      clientState.layout.swins.pop();
    } catch (e) {
      console.error(e);
      workspaceNameError =
        e instanceof Error ? e.message : "Failed to create the workspace.";
      await clientState.dialog.showError({
        title: "Failed to Create Workspace",
        message: "We couldn't create the workspace.",
        detail: workspaceNameError,
        buttons: ["OK"],
      });
    } finally {
      status = "idle";
    }
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    confirmCreateWorkspace();
  }
</script>

<div class="space-y-4">
  <h3 class="text-lg font-semibold">Name your workspace</h3>

  <form class="space-y-4" onsubmit={handleSubmit}>
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
        onfocus={suggestNameOnFocus}
        oninput={() => (workspaceNameError = "")}
      />
      {#if workspaceNameError}
        <p class="text-error-500 text-sm mt-2">{workspaceNameError}</p>
      {/if}
      {#if nameAlreadyExists && !workspaceNameError}
        <p class="text-warning-500 text-sm mt-2">
          A workspace with this name already exists in the selected folder.
        </p>
      {/if}
    </div>

    <div>
      <p class="mb-2">You can give a simple name that describes the purpose of the
        workspace:</p>
      <div class="flex flex-wrap gap-2">
        {#each presets as name}
          <button
            type="button"
            class="btn btn-sm preset-outlined"
            class:preset-filled={folderNameCandidate(name) ===
              folderNameCandidate(workspaceName)}
            onclick={() => (workspaceName = name)}
            disabled={status === "creating"}
          >
            {name}
          </button>
        {/each}
      </div>
    </div>

    <div
      class=""
    >
      <p>Your new workspace will be created in:</p>
      <span class="font-mono text-sm break-words">
        {workspaceFolderPreview ?? "Select a location"}
      </span>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        class="btn preset-ghost"
        onclick={closeWindow}
        disabled={status === "creating"}
      >
        Cancel
      </button>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="btn preset-outlined"
          onclick={chooseLocation}
          disabled={status === "creating"}
        >
          Change location
        </button>
        <button
          type="submit"
          class="btn preset-filled-primary-500"
          disabled={status === "creating" || nameAlreadyExists}
        >
          {status === "creating" ? "Creating..." : "Create workspace"}
        </button>
      </div>
    </div>
  </form>
</div>
