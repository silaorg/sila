<script lang="ts">
  import Lightswitch from "@sila/client/comps/basic/Lightswitch.svelte";
  import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { isDevMode } from "@sila/client/state/devMode";
  const clientState = useClientState();
  import { currentLanguage } from "@sila/client/state/txtStore";
  import {
    SUPPORTED_LANGUAGES,
    LANGUAGE_NAMES,
  } from "@sila/core";
  import { txtStore } from "@sila/client/state/txtStore";
  import ThemeSwitcher from "@sila/client/comps/themes/ThemeSwitcher.svelte";
</script>

<div>
  <!--<h2 class="h2 mb-4">{$txtStore.settingsPage.title}</h2>-->

  <div class="flex flex-col gap-6 w-full">
      <!--
    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.appearance.language}</h3>
      <div class="space-y-4">
        <select bind:value={$currentLanguage} class="select">
          {#each SUPPORTED_LANGUAGES as lang}
            <option value={lang}>{LANGUAGE_NAMES[lang]}</option>
          {/each}
        </select>
      </div>
    </div>
    -->

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.appearance.title}</h3>
      <div class="space-y-4">
        <label class="label">
          <span>Color scheme</span>
          <Lightswitch />
        </label>

        <label class="label">
          <span>Theme</span>
          <ThemeSwitcher />
        </label>
      </div>
    </div>

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.providers.title}</h3>
      <ModelProviders />
    </div>

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.spaces.title}</h3>
      <p class="mb-4">
        {$txtStore.settingsPage.spaces.spaceCount(
          clientState.pointers.length
        )}
      </p>
      <button class="btn preset-filled" onclick={() => clientState.layout.openSpaces()}>
        {$txtStore.settingsPage.spaces.manageButton}
      </button>
    </div>

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.developers.title}</h3>
      <button
        class="btn preset-filled"
        onclick={() => ($isDevMode = !$isDevMode)}
        >{$txtStore.settingsPage.developers.toggleDevMode}</button
      >
    </div>
  </div>
</div>
