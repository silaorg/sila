<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { Moon, Sun } from "lucide-svelte";
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
      ? "Switch to Light mode"
      : "Switch to Dark mode"}
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
    <option value="system">System</option>
    <option value="dark">Dark</option>
    <option value="light">Light</option>
  </select>
{/if}
