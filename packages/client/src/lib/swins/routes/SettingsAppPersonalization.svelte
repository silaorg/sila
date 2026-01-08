<script lang="ts">
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import { User } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { i18n } from "@sila/client";

  const clientState = useClientState();
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1 space-y-4">
    <div class="space-y-4">
      <div class="grid gap-1">
        <div class="text-sm font-medium">{i18n.texts.settingsPage.personalization.title}</div>
        <div class="text-sm text-surface-600-300">
          {i18n.texts.settingsPage.personalization.description}
        </div>
      </div>

      <div class="flex justify-end">
        <SwinsNavButton
          component="userProfile"
          title={i18n.texts.settingsPage.personalization.title}
          className="btn preset-filled-primary-500"
          pop="current"
        >
          <User size={16} />
          {i18n.texts.settingsPage.personalization.openProfile}
        </SwinsNavButton>
      </div>

      {#if !clientState.auth.isAuthenticated}
        <div class="text-xs text-surface-600-300">
          {i18n.texts.settingsPage.personalization.signInPlaceholder}
        </div>
      {/if}
    </div>
  </div>
</div>
