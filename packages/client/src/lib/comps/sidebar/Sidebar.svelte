<script lang="ts">
  import Settings from "lucide-svelte/icons/settings-2";
  import AppButtons from "./AppButtons.svelte";
  import AppTrees from "./AppTrees.svelte";
  import SpaceSelectorPopup from "../popups/SpaceSelectorPopup.svelte";
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";
  import ChatSearchPopover from "./ChatSearchPopover.svelte";
  import SidebarToggle from "./SidebarToggle.svelte";
</script>

<div class="flex flex-col h-full bg-surface-100-900/50" data-testid="sidebar">
  <div class="min-h-min py-2 px-2">
    <div class="flex items-center w-full pb-3">
      <div class="flex-1 min-w-0">
        <SpaceSelectorPopup />
      </div>
      <div class="flex items-center">
        <ChatSearchPopover />
        <SwinsNavButton
          component="settingsWorkspacePreferences"
          title="Preferences"
          className="p-2 rounded hover:preset-tonal"
          dataRole="open-settings"
        >
          <Settings size={18} />
        </SwinsNavButton>
        <SidebarToggle />
      </div>
    </div>
    <AppButtons />
  </div>
  <div class="flex-grow overflow-y-auto">
    <div class="px-2">
      <AppTrees />
    </div>
  </div>
</div>
