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

  function startRenamingThread() {
    // @TODO: implement renaming
    popoverClose();
  }

  function openInNewTab() {
    // @TODO: implement opening in new tab
    popoverClose();
  }

  function duplicateThread() {
    // @TODO: implement duplication
    popoverClose();
  }

  async function deleteThread() {
    clientState.currentSpaceState?.spaceTelemetry.chatDeleted({
      chat_id: appTreeId,
    });
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
        <button class="btn btn-sm text-left" onclick={startRenamingThread}
          >{i18n.texts.actions.rename}</button
        >

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
