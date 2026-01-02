<script lang="ts">
  import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
  import { txtStore } from "@sila/client/state/txtStore";
  import SettingsSidebar from "./SettingsSidebar.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  <div class="flex-1 space-y-4">
    <p class="text-sm">
      {$txtStore.settingsPage.providers.description}
    </p>
    <ModelProviders />
  </div>
</div>

