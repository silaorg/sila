<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import SpaceOpener from "./SpaceOpener.svelte";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  function handleOpen(spaceId?: string) {
    clientState.layout.swins.clear();
    if (spaceId) {
      // Ensure the new space becomes active
      clientState.switchToSpace(spaceId);
    }
  }
</script>

<div class="flex justify-between items-center pb-4 gap-4">
  <h3 class="h3">{i18n.texts.spacesPage.openerPageTitle}</h3>
</div>
<p class="mb-6">{i18n.texts.spacesPage.openerPageDescription}</p>

<SpaceOpener onSpaceSetup={handleOpen} />
