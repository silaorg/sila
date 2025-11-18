<script lang="ts">
  import { isDevMode } from "@sila/client/state/devMode";
  import { txtStore } from "@sila/client/state/txtStore";
  import SettingsSidebar from "./SettingsSidebar.svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />
  
  <div class="flex-1">
    <div class="space-y-4">
      <h3 class="h4">{$txtStore.settingsPage.developers.title}</h3>
      <label class="label">
        <span>{$txtStore.settingsPage.developers.toggleDevMode}</span>
        <input
          type="checkbox"
          class="checkbox"
          bind:checked={$isDevMode}
        />
      </label>
    </div>
  </div>
</div>

