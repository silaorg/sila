<script lang="ts">
  import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
  import { txtStore } from "@sila/client/state/txtStore";
  import SettingsSidebar from "./SettingsSidebar.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  <div class="flex-1">
    <div class="">
      <ModelProviders />
    </div>
  </div>
</div>

