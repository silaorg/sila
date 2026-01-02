<script lang="ts">
  import AppConfigTableCell from "@sila/client/comps/configs/AppConfigTableCell.svelte";
  import { i18n } from "@sila/client";
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
    <h3 class="h3">{i18n.texts.appPage.chatsTitle}</h3>
    <SwinsNavButton
      component="appConfig"
      title={i18n.texts.appPage.buttonNewConfig}
      className="btn preset-filled-primary-500"
    >
      <Plus size={16} />
      {i18n.texts.appPage.buttonNewConfig}
    </SwinsNavButton>
  </div>
  <p>
    {i18n.texts.appPage.description}
  </p>
  <div class="flex flex-col">
    {#each appConfigs as config (config.id)}
      <AppConfigTableCell {config} />
    {/each}
  </div>
</div>
