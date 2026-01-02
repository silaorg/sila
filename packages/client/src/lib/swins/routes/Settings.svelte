<script lang="ts">
  import { i18n } from "@sila/client";
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import Lightswitch from "@sila/client/comps/basic/Lightswitch.svelte";
  import ThemeSwitcher from "@sila/client/comps/themes/ThemeSwitcher.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  
  <div class="flex-1">  
    <div class="flex flex-col gap-4">

      <div class="space-y-4">
        <label class="label">
          <span>Color scheme</span>
          <Lightswitch />
        </label>

        <label class="label">
          <span>Theme</span>
          <ThemeSwitcher />
        </label>
      </div>
    </div>
  </div>
</div>
