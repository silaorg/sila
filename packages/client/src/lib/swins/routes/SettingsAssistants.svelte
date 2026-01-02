<script lang="ts">
  import AppConfigTableCell from "@sila/client/comps/configs/AppConfigTableCell.svelte";
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { AppConfig } from "@sila/core";
  const clientState = useClientState();
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import { Plus } from "lucide-svelte";
  import SettingsSidebar from "./SettingsSidebar.svelte";

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

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1 space-y-4">
    <p class="text-sm">
      {i18n.texts.appPage.description}
    </p>
    <div class="flex flex-col gap-2">
      {#each appConfigs as config (config.id)}
        <AppConfigTableCell {config} inSettings={true} />
      {/each}
    </div>
    <div class="flex justify-end">
      <SwinsNavButton
        component="appConfig"
        title={i18n.texts.appPage.buttonNewConfig}
        className="btn preset-filled-primary-500"
      >
        <Plus size={16} />
        {i18n.texts.appPage.buttonNewConfig}
      </SwinsNavButton>
    </div>
  </div>
</div>
