<script lang="ts">
  import { EllipsisVertical } from "lucide-svelte";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  let { appTreeId, onRename }: { appTreeId: string; onRename?: () => void } =
    $props();
  let openState = $state(false);

  function popoverClose() {
    openState = false;
  }

  function startRenamingThread() {
    popoverClose();
    setTimeout(() => onRename?.(), 0);
  }

  async function openInNewTab() {
    const layout = clientState.currentSpaceState?.layout;
    const space = clientState.currentSpace;
    if (!layout || !space) {
      popoverClose();
      return;
    }

    try {
      const refVertex = space.getVertexReferencingAppTree(appTreeId);
      const appTree = await space.loadAppTree(appTreeId);
      const appId = appTree?.getAppId();
      const appTreeName =
        (appTree?.tree.root?.getProperty("name") as string | undefined) ??
        appTree?.tree.root?.name;
      const resolvedName =
        appTreeName ??
        refVertex?.name ??
        (appId === "files" ? "Files" : "New chat");

      if (appId === "files") {
        layout.openFilesTabInNewTab(appTreeId, resolvedName);
      } else {
        layout.openChatTabInNewTab(appTreeId, resolvedName);
      }
    } catch (error) {
      console.warn("Failed to open in new tab:", error);
    } finally {
      popoverClose();
    }
  }

  function duplicateThread() {
    // @TODO: implement duplication
    popoverClose();
  }

  async function deleteThread() {
    const layout = clientState.currentSpaceState?.layout;
    if (layout) {
      layout.closeTabsByTreeId(appTreeId);
    }
    clientState.currentSpaceState?.spaceTelemetry.chatDeleted({
      chat_id: appTreeId,
    });
    clientState.currentSpace?.deleteAppTree(appTreeId);
    popoverClose();
  }
</script>

<div
  class={`flex justify-center items-center mt-1 mr-2 transition-opacity ${
    openState
      ? "opacity-100 pointer-events-auto"
      : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
  }`}
>
  <ContextMenu
    open={openState}
    onOpenChange={(e) => (openState = e.open)}
    placement="bottom"
    triggerClassNames=""
  >
    {#snippet trigger()}
      <EllipsisVertical size={14} />
    {/snippet}

    {#snippet content()}
      <div class="flex flex-col gap-1">
        <button class="btn btn-sm text-left" onclick={openInNewTab}
          >{i18n.texts.appTreeMenu.openInNewTab}</button
        >
        <button class="btn btn-sm text-left" onclick={startRenamingThread}
          >{i18n.texts.actions.rename}</button
        >

        <div class="border-t border-surface-200-800 my-2"></div>
        <!--
        <button class="btn btn-sm text-left" onclick={duplicateThread}
          >{i18n.texts.actions.duplicate}</button
        >
        -->
        <button
          class="btn btn-sm preset-filled-error-500 text-left"
          onclick={deleteThread}>{i18n.texts.actions.delete}</button
        >
      </div>
    {/snippet}
  </ContextMenu>
</div>
