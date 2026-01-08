<script lang="ts">
  import { EllipsisVertical } from "lucide-svelte";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  let { appTreeId }: { appTreeId: string } = $props();
  let openState = $state(false);

  function popoverClose() {
    openState = false;
  }

  // function startRenamingThread() {
  //   // @TODO: implement renaming
  //   popoverClose();
  // }

  async function openInNewTab() {
    const space = clientState.currentSpace;
    const layout = clientState.currentSpaceState?.layout;
    if (!space || !layout) {
      popoverClose();
      return;
    }

    const appTree = await space.loadAppTree(appTreeId);
    const appId = appTree?.getAppId();
    const appTreeName =
      (appTree?.tree.root?.getProperty("name") as string | undefined) ??
      space.getVertexReferencingAppTree(appTreeId)?.name;

    if (appId === "files") {
      layout.openFilesTab(appTreeId, appTreeName ?? "Files");
    } else {
      layout.openChatTab(appTreeId, appTreeName ?? "New chat");
    }
    popoverClose();
  }

  async function duplicateThread() {
    const space = clientState.currentSpace;
    const layout = clientState.currentSpaceState?.layout;
    if (!space || !layout) {
      popoverClose();
      return;
    }

    const appTree = await space.loadAppTree(appTreeId);
    const appId = appTree?.getAppId();
    if (!appId) {
      popoverClose();
      return;
    }

    const appTreeName =
      (appTree?.tree.root?.getProperty("name") as string | undefined) ??
      space.getVertexReferencingAppTree(appTreeId)?.name ??
      "New chat";
    const newTree = space.newAppTree(appId);
    space.setAppTreeName(newTree.getId(), `${appTreeName} copy`);

    if (appId === "files") {
      layout.openFilesTab(newTree.getId(), `${appTreeName} copy`);
    } else {
      layout.openChatTab(newTree.getId(), `${appTreeName} copy`);
    }
    popoverClose();
  }

  async function deleteThread() {
    clientState.currentSpace?.deleteAppTree(appTreeId);
    popoverClose();
  }
</script>

<div class="flex justify-center items-center mt-1 mr-2">
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
        <!-- <button class="btn btn-sm text-left" onclick={startRenamingThread}
          >{i18n.texts.actions.rename}</button
        > -->

        <div class="border-t border-surface-200-800 my-2"></div>

        <button class="btn btn-sm text-left" onclick={duplicateThread}
          >{i18n.texts.actions.duplicate}</button
        >
        <button
          class="btn btn-sm preset-filled-error-500 text-left"
          onclick={deleteThread}>{i18n.texts.actions.delete}</button
        >
      </div>
    {/snippet}
  </ContextMenu>
</div>
