<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import SpaceOptionsPopup from "@sila/client/comps/popups/SpaceOptionsPopup.svelte";
  const clientState = useClientState();
  import RenamingPopup from "@sila/client/comps/popups/RenamingPopup.svelte";
  import type { SpacePointer } from "@sila/client/spaces/SpacePointer";
  import { Circle, CircleCheckBig } from "lucide-svelte";
  import { i18n } from "@sila/client";

  let renamingPopupOpen = $state(false);
  let spaceToRename = $state<SpacePointer | null>(null);

  function selectSpace(spaceId: string) {
    clientState.switchToSpace(spaceId);
  }

  function handleRename(newName: string) {
    if (!spaceToRename) {
      return;
    }

    clientState.updateSpaceName(spaceToRename.id, newName);

    const updatedPointers = clientState.pointers.map((space) =>
      space.id === spaceToRename?.id ? { ...space, name: newName } : space,
    );
    clientState.pointers = updatedPointers;
    spaceToRename = null;
  }

  function openRenamePopup(space: SpacePointer) {
    spaceToRename = space;
    renamingPopupOpen = true;
  }

  function handleRemoveSpace(space: SpacePointer) {
    clientState.removeSpace(space.id);
    // So if we access the list from swins - close it
    clientState.layout.swins.pop();
  }
</script>

{#if clientState.pointers.length > 0}
  <div class="space-y-2">
    {#each clientState.pointers as space (space.id)}
      <div
        class="p-2 rounded bg-surface-200-800-token border {space.id ===
        clientState.currentSpaceId
          ? 'border-primary-500'
          : 'border-surface-100-900'} flex items-center gap-3"
      >
        <!-- Radio Icon -->
        <div 
          class="flex-shrink-0 cursor-pointer hover:bg-surface-300-600-token rounded p-1 -m-1"
          onclick={() => selectSpace(space.id)}
          onkeydown={(e) => e.key === "Enter" && selectSpace(space.id)}
          role="button"
          tabindex="0"
        >
          {#if space.id === clientState.currentSpaceId}
            <CircleCheckBig size={20} class="text-primary-500" />
          {:else}
            <Circle size={20} class="text-surface-500" />
          {/if}
        </div>

        <!-- Clickable Title/Subtitle Area -->
        <div
          onclick={() => selectSpace(space.id)}
          onkeydown={(e) => e.key === "Enter" && selectSpace(space.id)}
          role="button"
          tabindex="0"
          class="flex-grow cursor-pointer hover:bg-surface-300-600-token rounded px-2 py-1 -mx-2 -my-1 ph-no-capture"
          data-role="select-space"
        >
          <div class="font-semibold">
            {space.name || i18n.texts.spacesList.newSpaceLabel}
          </div>
          {#if space.uri.startsWith("browser")}
            <div class="text-sm opacity-70">
              {i18n.texts.spacesList.localSpaceLabel}
            </div>
          {:else}
            <div class="text-sm opacity-70">{space.uri}</div>
          {/if}
        </div>

        <!-- Options Button -->
        <div class="flex-shrink-0">
          <SpaceOptionsPopup
            spaceUri={space.uri}
            onRename={() => openRenamePopup(space)}
            onRemove={() => handleRemoveSpace(space)}
          />
        </div>
      </div>
    {/each}
  </div>
{:else}
  <p class="text-center opacity-70">{i18n.texts.spacesList.noSpacesFound}</p>
{/if}

{#if spaceToRename}
  <RenamingPopup
    bind:open={renamingPopupOpen}
    existingName={spaceToRename.name ? spaceToRename.name : undefined}
    onRename={handleRename}
  />
{/if}

<style>
  .space-y-2 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 0.5rem;
  }
</style>
