<script lang="ts">
  import SpaceList from "@sila/client/comps/spaces/SpaceList.svelte";
  import { txtStore } from "@sila/client/state/txtStore";
  import { Plus } from "lucide-svelte";
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import SettingsSidebar from "./SettingsSidebar.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  
  <div class="flex-1 space-y-4">
    <p class="text-sm">
      {$txtStore.spacesPage.description}
    </p>
    <SpaceList />
    <div class="flex justify-end">
      <SwinsNavButton
        className="btn preset-filled-primary-500"
        component="open-space"
        title="Add a workspace"
      >
        <Plus size={16} />
        Add a workspace
      </SwinsNavButton>
    </div>
  </div>
</div>

