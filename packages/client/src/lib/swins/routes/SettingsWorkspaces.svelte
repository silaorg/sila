<script lang="ts">
  import SpaceList from "@sila/client/comps/spaces/SpaceList.svelte";
  import { i18n } from "@sila/client";
  import { Plus } from "lucide-svelte";
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import SettingsSidebar from "./SettingsSidebar.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  
  <div class="flex-1 space-y-4">
    <p class="text-sm">
      {i18n.texts.spacesPage.description}
    </p>
    <SpaceList />
    <div class="flex justify-end">
      <SwinsNavButton
        className="btn preset-filled-primary-500"
        component="openSpace"
        title={i18n.texts.spacesPage.addWorkspaceButton}
      >
        <Plus size={16} />
        {i18n.texts.spacesPage.addWorkspaceButton}
      </SwinsNavButton>
    </div>
  </div>
</div>
