<script lang="ts">
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import { User } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1 space-y-4">
    <div class="space-y-4">
      <div class="grid gap-1">
        <div class="text-sm font-medium">User profile</div>
        <div class="text-sm text-surface-600-300">
          @TODO: user name, “about you” preferences used for personalization.
        </div>
      </div>

      <div class="flex justify-end">
        <SwinsNavButton
          component="userProfile"
          title="User profile"
          className="btn preset-filled-primary-500"
          pop="current"
        >
          <User size={16} />
          Open profile
        </SwinsNavButton>
      </div>

      {#if !clientState.auth.isAuthenticated}
        <div class="text-xs text-surface-600-300">
          @TODO: sign-in UX here (or link to sign-in) when auth is enabled.
        </div>
      {/if}
    </div>
  </div>
</div>

