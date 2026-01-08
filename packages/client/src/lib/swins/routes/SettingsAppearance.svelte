<script lang="ts">
  import Lightswitch from "@sila/client/comps/basic/Lightswitch.svelte";
  import ThemeSwitcher from "@sila/client/comps/themes/ThemeSwitcher.svelte";
  import { i18n } from "@sila/client";
  import SettingsSidebar from "./SettingsSidebar.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  
  <div class="flex-1 space-y-4">
    <div class="space-y-4">
      <label class="label">
        <span>{i18n.texts.settingsPage.appearance.colorScheme}</span>
        <Lightswitch />
      </label>

      <label class="label">
        <span>{i18n.texts.settingsPage.appearance.theme}</span>
        <ThemeSwitcher />
      </label>
    </div>
  </div>
</div>
