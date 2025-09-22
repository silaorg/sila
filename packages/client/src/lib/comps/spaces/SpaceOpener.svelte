<script lang="ts">
  import { txtStore } from "@sila/client/state/txtStore";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  type Status = "idle" | "creating" | "opening";
  let status: Status = $state("idle");

  let {
    onSpaceSetup,
  }: { onSpaceSetup?: (spaceId: string) => void } = $props();

  async function createSpaceDialog() {
    if (status !== "idle") return;

    status = "creating";
    try {
      const path = await clientState.dialog.openDialog({
        title: $txtStore.spacesPage.opener.dialogCreateTitle,
        directory: true,
      });

      if (!path || Array.isArray(path)) {
        status = "idle";
        return;
      }

      const spaceId = await clientState.createSpace(path);
      onSpaceSetup?.(spaceId);
    } catch (e) {
      console.error(e);
      
      // Show native error dialog to user
      await clientState.dialog.showError({
        title: "Failed to Create Space",
        message: $txtStore.spacesPage.opener.errorCreate,
        detail: e instanceof Error ? e.message : "An unknown error occurred while creating the space.",
        buttons: ["OK"]
      });
    } finally {
      status = "idle";
    }
  }

  async function openSpaceDialog() {
    if (status !== "idle") return;

    status = "opening";
    try {
      const path = await clientState.dialog.openDialog({
        title: $txtStore.spacesPage.opener.dialogOpenTitle,
        directory: true,
      });

      if (!path) {
        status = "idle";
        return;
      }

      // @TODO: should I handle path as array or string?

      const spaceId = await clientState.loadSpace(path as string);
      onSpaceSetup?.(spaceId);
    } catch (e) {
      console.error(e);
      
      // Show native error dialog to user
      await clientState.dialog.showError({
        title: "Failed to Open Space",
        message: $txtStore.spacesPage.opener.errorOpen,
        detail: e instanceof Error ? e.message : "An unknown error occurred while opening the space.",
        buttons: ["OK"]
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
      onclick={createSpaceDialog}
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
