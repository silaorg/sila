<script lang="ts">
  import Lightswitch from "@sila/client/comps/basic/Lightswitch.svelte";
  import ThemeSwitcher from "@sila/client/comps/themes/ThemeSwitcher.svelte";
  import { i18n } from "@sila/client";
  import SettingsSidebar from "./SettingsSidebar.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  
  <div class="flex-1">
    <h2 class="h2 mb-6">{i18n.texts.settingsPage.appearance.title}</h2>
    
    <div class="card p-4 border-[1px] border-surface-200-800">
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

