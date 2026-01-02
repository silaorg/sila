<script lang="ts">
  import { i18n } from "@sila/client";
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import Lightswitch from "@sila/client/comps/basic/Lightswitch.svelte";
  import ThemeSwitcher from "@sila/client/comps/themes/ThemeSwitcher.svelte";
  import LanguageSwitcher from "@sila/client/comps/settings/LanguageSwitcher.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  
  <div class="flex-1">  
    <div class="flex flex-col gap-4">

      <div class="space-y-4">
        <label class="label">
          <span>{i18n.texts.settingsPage.appearance.colorScheme}</span>
          <Lightswitch />
        </label>

        <label class="label">
          <span>{i18n.texts.settingsPage.appearance.theme}</span>
          <ThemeSwitcher />
        </label>

        <label class="label">
          <span>{i18n.texts.settingsPage.appearance.language}</span>
          <LanguageSwitcher />
        </label>
      </div>
    </div>
  </div>
</div>
