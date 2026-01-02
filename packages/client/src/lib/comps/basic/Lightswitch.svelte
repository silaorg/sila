<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { Moon, Sun } from "lucide-svelte";
  import { i18n } from "@sila/client";
  const clientState = useClientState();

  let { tiny = false } = $props();

  let currentColorScheme: "light" | "dark" | "system" = $state("system");

  $effect(() => {
    currentColorScheme = clientState.theme.colorScheme;
  });

  // Handle the toggle button click (tiny mode)
  async function handleSwitch() {
    const targetColorScheme =
      clientState.theme.colorScheme === "dark" ? "light" : "dark";
    await clientState.theme.setColorScheme(targetColorScheme);
    currentColorScheme = targetColorScheme;
  }

  async function changeColorScheme() {
    await clientState.theme.setColorScheme(currentColorScheme);
  }
</script>

{#if tiny}
  <button
    class="cursor-pointer"
    onclick={handleSwitch}
    title={currentColorScheme === "dark"
      ? i18n.texts.settingsPage.appearance.switchToLightMode
      : i18n.texts.settingsPage.appearance.switchToDarkMode}
  >
    {#if currentColorScheme === "dark"}
      <Sun size={18} />
    {:else}
      <Moon size={18} />
    {/if}
  </button>
{:else}
  <select
    class="select"
    bind:value={currentColorScheme}
    onchange={changeColorScheme}
  >
    <option value="system">{i18n.texts.settingsPage.appearance.system}</option>
    <option value="dark">{i18n.texts.settingsPage.appearance.dark}</option>
    <option value="light">{i18n.texts.settingsPage.appearance.light}</option>
  </select>
{/if}
