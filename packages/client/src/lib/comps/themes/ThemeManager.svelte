<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import { applyColorSchemeToDocument } from "@sila/client/utils/updateColorScheme";
  import { onMount } from "svelte";

  function applyThemeToDocument(themeName: string) {
    document.documentElement.setAttribute("data-theme", themeName);
  }

  function colorSchemeChangeHandler() {
    applyColorSchemeToDocument(clientState.theme.colorScheme);
  }

  onMount(() => {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", colorSchemeChangeHandler);

    return () => {
      window.removeEventListener("change", colorSchemeChangeHandler);
    };
  });

  $effect(() => {
    applyThemeToDocument(clientState.theme.themeName);
  });

  $effect(() => {
    applyColorSchemeToDocument(clientState.theme.colorScheme);
  });

  $effect(() => {
    // Save to localStorage for the next app launch so it doesn't flash and shows
    // the latest theme and color scheme of the current space
    if (clientState.currentSpaceState?.isConnected) {
      localStorage.setItem("themeName", clientState.theme.themeName);
      localStorage.setItem("colorScheme", clientState.theme.colorScheme);
    }
  });
</script>
