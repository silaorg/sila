<script lang="ts">
  import AppConfigTableCell from "@sila/client/comps/configs/AppConfigTableCell.svelte";
  import { txtStore } from "@sila/client/state/txtStore";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { AppConfig } from "@sila/core";
  const clientState = useClientState();
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import { Plus } from "lucide-svelte";

  let appConfigs = $state<AppConfig[]>([]);
  let appConfigUnobserve: (() => void) | undefined;

  $effect(() => {
    appConfigUnobserve = clientState.currentSpace?.appConfigs.observe(
      (configs) => {
        appConfigs = configs;
      }
    );

    return () => {
      appConfigUnobserve?.();
    };
  });
</script>

<div class="card space-y-4">
  <div class="flex justify-between items-center">
    <h3 class="h3">Your Assistants</h3>
    <SwinsNavButton
      component="app-config"
      title="New Assistant"
      className="btn preset-filled-primary-500"
    >
      <Plus size={16} />
      {$txtStore.appPage.buttonNewConfig}
    </SwinsNavButton>
  </div>
  <p>
    You can create and edit your chat assistants here. You will see the
    assistant buttons in the right top of the sidebar.
  </p>
  <div class="flex flex-col">
    {#each appConfigs as config (config.id)}
      <AppConfigTableCell {config} />
    {/each}
  </div>
</div>
