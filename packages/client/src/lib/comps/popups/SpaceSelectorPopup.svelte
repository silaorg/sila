<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { i18n } from "@sila/client";
  const clientState = useClientState();
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import { ChevronsUpDown } from "lucide-svelte";

  let openState = $state(false);
</script>

<ContextMenu
  open={openState}
  onOpenChange={(e) => (openState = e.open)}
  placement="bottom"
  triggerClassNames="w-full"
>
  {#snippet trigger()}
    <div class="w-full h-full">
      <div
        class="flex items-center gap-2 w-full h-full py-1 px-1 rounded hover:preset-tonal"
      >
        <ChevronsUpDown size={18} class="flex-shrink-0" />
        <span class="flex-1 min-w-0 truncate text-left"
          >{clientState.currentSpace?.name}</span
        >
      </div>
    </div>
  {/snippet}
  {#snippet content()}
    <div class="flex flex-col gap-1">
      {#each clientState.pointers as pointer (pointer.uri)}
        <button
          class="btn btn-sm w-full text-left justify-start"
          class:preset-filled-secondary-500={pointer.uri ===
            clientState.currentSpaceUri}
          onclick={() => (clientState.switchToSpace(pointer.uri))}
        >
          <span>
            <strong>
              {pointer.name || i18n.texts.spacesPage.defaultWorkspaceName}
            </strong>
          </span>
        </button>
      {/each}
    </div>
    <div class="flex flex-col gap-1 mt-4">
      <button
        class="btn btn-sm w-full text-left justify-start"
        onclick={() => {
          clientState.layout.openSpaces();
          openState = false;
        }}
      >
        {i18n.texts.spacesPage.manageWorkspacesButton}
      </button>
    </div>
  {/snippet}
</ContextMenu>
