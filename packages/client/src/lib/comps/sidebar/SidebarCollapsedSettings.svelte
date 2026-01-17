<script lang="ts">
  import Settings from "lucide-svelte/icons/settings-2";
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";
</script>

<SwinsNavButton
  component="settingsWorkspacePreferences"
  title="Preferences"
  className="p-2 rounded hover:preset-tonal"
  dataRole="open-settings"
>
  <Settings size={18} />
</SwinsNavButton>
