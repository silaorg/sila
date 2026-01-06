<script lang="ts">
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import { ArrowRight } from "lucide-svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  
  <div class="flex-1 space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="text-sm text-surface-600-300">
        Pick a category on the left.
      </div>
      <div class="flex gap-2">
        <SwinsNavButton
          component="settingsWorkspacePreferences"
          pop="current"
          title="Workspace · Preferences"
          className="btn preset-filled-primary-500"
        >
          Workspace <ArrowRight size={16} />
        </SwinsNavButton>
        <SwinsNavButton
          component="settingsAppPersonalization"
          pop="current"
          title="App · Personalization"
          className="btn preset-filled-primary-500"
        >
          App <ArrowRight size={16} />
        </SwinsNavButton>
      </div>
    </div>
  </div>
</div>
