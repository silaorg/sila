<script lang="ts">
  import { MoreVertical } from "lucide-svelte";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import { i18n } from "@sila/client";

  let { 
    onRename = () => {},
    onRemove = () => {},
  }: { 
    onRename: () => void;
    onRemove: () => void;
  } = $props();
  let openState = $state(false);

  function handleRename() {
    openState = false;
    onRename();
  }

  function handleRemove() {
    openState = false;
    onRemove();
  }

  // stub for duplicating the space
  function handleDuplicate() {
    openState = false;
    // @TODO: implement duplicate functionality
  }
</script>

<div class="flex justify-center items-center mt-1 mr-2">
  <ContextMenu
    open={openState}
    onOpenChange={(e) => openState = e.open}
    placement="bottom"
    triggerClassNames=""
  >
    {#snippet trigger()}
      <button class="btn-icon variant-soft">
        <MoreVertical size={18} />
      </button>
    {/snippet}

    {#snippet content()}
      <div class="flex flex-col gap-1">
        <button class="btn btn-sm text-left" onclick={handleRename}>
          {i18n.texts.actions.rename}
        </button>
        <div class="border-t border-surface-200-800 my-2"></div>
        <button
          class="btn btn-sm preset-filled-error-500 text-left"
          onclick={handleRemove}
        >
          {i18n.texts.actions.removeFromList}
        </button>
      </div>
    {/snippet}
  </ContextMenu>
</div>
