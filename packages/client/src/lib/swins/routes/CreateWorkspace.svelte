<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";

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

  const presetNames = ["Personal", "Work", "Studies", "School"];

  let workspaceName = $state(presetNames[0]);
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
    if (!currentParentPath) {
      return null;
    }

    return `${currentParentPath}/${folderNameCandidate(workspaceName)}`;
  });

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

      currentParentPath = path;
      onParentPathChange?.(path);
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

  function closeWindow() {
    onCancel?.(currentParentPath ?? undefined);
    clientState.layout.swins.pop();
  }

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

    if (!currentParentPath) {
      workspaceNameError = "Choose a folder to store the workspace.";
      return;
    }

    const targetPath = `${currentParentPath}/${folderName}`;

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
      workspaceNameError = e instanceof Error ? e.message : "Failed to create the workspace.";
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
      <strong class="block text-surface-500">Will be created in</strong>
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
          disabled={status === "creating"}
        >
          {status === "creating" ? "Creating..." : "Create workspace"}
        </button>
      </div>
    </div>
  </form>
</div>

