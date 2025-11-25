<script lang="ts">
  import SpaceList from "@sila/client/comps/spaces/SpaceList.svelte";
  import { txtStore } from "@sila/client/state/txtStore";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { Plus } from "lucide-svelte";
  const clientState = useClientState();
  import SwinsNavButton from "../SwinsNavButton.svelte";

  /*
  async function handleNewSpace() {
    await clientState.createNewSpace('local');
    clientState.layout.swins.clear();
  }
  */
</script>

<div class="flex justify-between items-center pb-4">
  <h3 class="h3">{$txtStore.spacesPage.title}</h3>
  <SwinsNavButton
    className="btn preset-filled-primary-500"
    component="openSpace"
    title="Add a workspace"
  >
    <Plus size={16} />
    Add a workspace
  </SwinsNavButton>
</div>
<p class="mb-6">
  {$txtStore.spacesPage.description}
</p>
<SpaceList />
